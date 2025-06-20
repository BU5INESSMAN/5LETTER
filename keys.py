import pymorphy2

morph = pymorphy2.MorphAnalyzer()

with open('russian.txt', 'r', encoding='utf-8') as f:
    all_words = set(word.strip().lower() for word in f if len(word.strip()) == 5)

valid_words = set()

for word in all_words:
    parses = morph.parse(word)
    for p in parses:
        if 'NOUN' in p.tag and 'sing' in p.tag and 'nomn' in p.tag:
            valid_words.add(word)
            break

with open('words.txt', 'w', encoding='utf-8') as f_out:
    for w in sorted(valid_words):
        f_out.write(w + '\n')
