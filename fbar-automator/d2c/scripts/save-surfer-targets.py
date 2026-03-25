"""Helper to save SurferSEO NLP targets as JSON. Called with JSON string on stdin."""
import json, sys

raw = json.loads(sys.argv[1])
slug = raw['slug']
keyword = raw['keyword']
draft_id = raw['surferDraftId']

data = {
    'slug': slug,
    'keyword': keyword,
    'surferDraftId': draft_id,
    'extractedAt': '2026-03-02T00:00:00Z',
    'contentScore': {'current': raw['contentScore'], 'avg': raw['avg'], 'top': raw['top']},
    'targets': {
        'wordCount': raw['wordCount'],
        'headings': raw['headings']
    },
    'terms': {
        'high_priority': [],
        'medium_priority': []
    }
}

for t in raw['terms']:
    entry = {'term': t['term'], 'targetMin': t['targetMin'], 'targetMax': t['targetMax']}
    if t['targetMin'] >= 3:
        data['terms']['high_priority'].append(entry)
    else:
        data['terms']['medium_priority'].append(entry)

path = f'C:/Users/1matt/OneDrive/Documents/atmix/fbar-automator/d2c/src/content/drafts/{slug}.surfer-targets.json'
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print(f'Saved {slug}: {len(data["terms"]["high_priority"])} high, {len(data["terms"]["medium_priority"])} medium, score={raw["contentScore"]}')
