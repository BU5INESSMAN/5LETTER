import os
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import random

app = Flask(__name__)
app.secret_key = os.urandom(24)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///game.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'avatars')
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # 2 МБ

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    solved_count = db.Column(db.Integer, default=0)
    total_errors = db.Column(db.Integer, default=0)  # Общее количество 

    solved_day = db.Column(db.Integer, default=0)
    solved_week = db.Column(db.Integer, default=0)
    solved_month = db.Column(db.Integer, default=0)
    stats_updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    avatar_url = db.Column(db.String(255), nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def update_stats(self):
        now = datetime.utcnow()
        if self.stats_updated_at.date() != now.date():
            self.solved_day = 0
        if self.stats_updated_at < now - timedelta(days=7):
            self.solved_week = 0
        if self.stats_updated_at < now - timedelta(days=30):
            self.solved_month = 0
        self.stats_updated_at = now

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

with open('words.txt', encoding='utf-8') as f:
    valid_words = set(line.strip().lower() for line in f if line.strip())

with open('keys.txt', encoding='utf-8') as f:
    key_words = [line.strip().lower() for line in f if line.strip()]

def choose_word():
    return random.choice(key_words)

@app.route('/')
@login_required
def home():
    if 'target_word' not in session:
        session['target_word'] = choose_word()
        session['attempts'] = 0

    top_users = User.query.order_by(User.solved_count.desc()).limit(10).all()
    rank = User.query.filter(User.solved_count > current_user.solved_count).count() + 1

    return render_template('game.html', top_users=top_users, user_rank=rank)

@app.route('/statistics')
@login_required
def statistics():
    period = request.args.get('period', 'month')
    if period not in ['day', 'week', 'month']:
        period = 'month'

    if period == 'day':
        users = User.query.order_by(User.solved_day.desc()).all()
    elif period == 'week':
        users = User.query.order_by(User.solved_week.desc()).all()
    else:
        users = User.query.order_by(User.solved_month.desc()).all()

    return render_template('statistics.html', users=users, period=period)

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html', user=current_user, editable=True)

@app.route('/profile/<int:user_id>')
@login_required
def profile_view(user_id):
    user = User.query.get_or_404(user_id)
    editable = (user.id == current_user.id)
    return render_template('profile.html', user=user, editable=editable)


@app.route('/profile/edit_avatar', methods=['POST'])
@login_required
def edit_avatar():
    if 'avatar' not in request.files:
        flash("Файл не выбран", "error")
        return redirect(url_for('profile'))

    file = request.files['avatar']
    if file.filename == '':
        flash("Файл не выбран", "error")
        return redirect(url_for('profile'))

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower()
        filename = f"user_{current_user.id}_{int(datetime.utcnow().timestamp())}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        file.save(filepath)

        if current_user.avatar_url:
            old_path = os.path.join(app.config['UPLOAD_FOLDER'], current_user.avatar_url)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception:
                    pass

        current_user.avatar_url = filename
        db.session.commit()
        flash("Аватар успешно обновлён", "success")
        return redirect(url_for('profile'))
    else:
        flash("Недопустимый формат файла. Разрешены: png, jpg, jpeg, gif", "error")
        return redirect(url_for('profile'))

@app.route('/new_word', methods=['POST'])
@login_required
def new_word():
    session['target_word'] = choose_word()
    session['attempts'] = 0
    return '', 204

@app.route('/check', methods=['POST'])
@login_required
def check():
    data = request.get_json()
    guess = data.get('guess', '').lower()

    if len(guess) != 5:
        return jsonify({'error': 'Слово должно быть из 5 букв'}), 400
    if guess not in valid_words:
        return jsonify({'error': 'Слово отсутствует в словаре'}), 400

    target = session.get('target_word')
    if not target:
        return jsonify({'error': 'Игра не инициализирована'}), 400

    session['attempts'] += 1

    result = [None]*5
    target_letters = list(target)

    # Проверяем буквы на правильность позиции (зелёные)
    for i in range(5):
        if guess[i] == target[i]:
            result[i] = 'green'
            target_letters[i] = None

    # Проверяем буквы на наличие в слове (жёлтые и серые)
    for i in range(5):
        if result[i] is None:
            if guess[i] in target_letters:
                result[i] = 'yellow'
                target_letters[target_letters.index(guess[i])] = None
            else:
                result[i] = 'gray'

    solved = all(color == 'green' for color in result)

    if solved:
        current_user.solved_count = (current_user.solved_count or 0) + 1
        current_user.update_stats()
        current_user.solved_day = (current_user.solved_day or 0) + 1
        current_user.solved_week = (current_user.solved_week or 0) + 1
        current_user.solved_month = (current_user.solved_month or 0) + 1
        db.session.commit()
        session.pop('target_word')
        session.pop('attempts')
        return jsonify({'result': result, 'message': 'Победа!', 'solved_count': current_user.solved_count})

    # Если не угадал и это последняя попытка — считаем ошибку
    if session['attempts'] >= 6:
        current_user.total_errors = (current_user.total_errors or 0) + 1
        db.session.commit()
        word = target
        session.pop('target_word')
        session.pop('attempts')
        return jsonify({'result': result, 'message': f'Игра окончена! Загаданное слово: {word}', 'solved_count': current_user.solved_count})

    db.session.commit()
    return jsonify({'result': result, 'attempts_left': 6 - session['attempts'], 'solved_count': current_user.solved_count})


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        if not username or not password:
            return render_template('register.html', error="Пожалуйста, заполните все поля")

        if User.query.filter_by(username=username).first():
            return render_template('register.html', error="Имя пользователя уже занято")

        new_user = User(username=username)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        return redirect(url_for('home'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('home'))
        else:
            return render_template('login.html', error="Неверное имя пользователя или пароль")

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/profile/edit_nickname', methods=['GET', 'POST'])
@login_required
def edit_nickname():
    if request.method == 'GET':
        return render_template('edit_nickname.html')

    new_nick = request.form.get('nickname', '').strip()
    if len(new_nick) < 3 or len(new_nick) > 50:
        flash("Никнейм должен быть от 3 до 50 символов", "error")
        return redirect(url_for('edit_nickname'))

    if User.query.filter(User.username == new_nick, User.id != current_user.id).first():
        flash("Никнейм уже занят", "error")
        return redirect(url_for('edit_nickname'))

    current_user.username = new_nick
    db.session.commit()
    flash("Никнейм успешно изменён", "success")
    return redirect(url_for('profile'))

@app.route('/profile/edit_password', methods=['GET', 'POST'])
@login_required
def edit_password():
    if request.method == 'GET':
        return render_template('edit_password.html')

    old_password = request.form.get('old_password', '')
    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')

    if not current_user.check_password(old_password):
        flash("Старый пароль неверен", "error")
        return redirect(url_for('edit_password'))

    if len(new_password) < 6:
        flash("Новый пароль должен быть минимум 6 символов", "error")
        return redirect(url_for('edit_password'))

    if new_password != confirm_password:
        flash("Новый пароль и подтверждение не совпадают", "error")
        return redirect(url_for('edit_password'))

    current_user.set_password(new_password)
    db.session.commit()
    flash("Пароль успешно изменён", "success")
    return redirect(url_for('profile'))


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
