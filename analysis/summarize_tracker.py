"""Summarize exported tracker events without reading or printing form values.

Usage: python3 analysis/summarize_tracker.py EXPORT.json VARIANT
Accepts a sessions/events export or joined session/event rows from SQLite.
"""

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


def summarize(data, variant):
    if isinstance(data, dict):
        sessions = {row['id']: row for row in data['sessions']}
        rows = data['events']
    else:
        sessions = {row['id']: row for row in data}
        rows = data
    if any('seq' not in row for row in rows):
        raise ValueError('Export event seq to attribute conversions to the last CTA reliably.')
    events = defaultdict(list)
    for row in rows:
        payload = row['payload']
        if isinstance(payload, str):
            payload = json.loads(payload)
        events[row.get('session_id', row.get('id'))].append({**row, 'payload': payload})
    exposed = {
        sid for sid, items in events.items()
        if any(item['payload'].get('name') == 'experiment_exposure'
               and item['payload'].get('properties', {}).get('variant') == variant
               for item in items)
    }
    sources = defaultdict(lambda: defaultdict(set))
    funnel = defaultdict(set)
    event_counts = Counter()
    conversion_sources = {}
    for sid in sorted(exposed):
        items = sorted(events[sid], key=lambda item: item['seq'])
        last_source = 'unattributed'
        for item in items:
            payload = item['payload']
            props = payload.get('properties', {})
            if props.get('variant') != variant:
                continue
            name = payload.get('name', item['kind'])
            event_counts[name] += 1
            funnel[name].add(sid)
            if name == 'registration_cta':
                last_source = props.get('source', 'unattributed')
                sources[last_source]['cta_sessions'].add(sid)
            if name == 'registration_view':
                sources[last_source]['form_view_sessions'].add(sid)
            if name == 'registration_field_focus' and props.get('step') != 'name':
                sources[last_source]['subsequent_field_focus_sessions'].add(sid)
            if item['kind'] == 'conversion_success':
                sources[last_source]['conversion_sessions'].add(sid)
                conversion_sources[sid] = last_source
    starts = [sessions[sid]['started_at'] for sid in exposed]
    return {
        'variant': variant,
        'session_count': len(exposed),
        'active_sessions': sum(not sessions[sid]['ended'] for sid in exposed),
        'window_utc': [datetime.fromtimestamp(value / 1000, timezone.utc).isoformat()
                       for value in (min(starts), max(starts))] if starts else [],
        'unique_session_funnel': {key: len(value) for key, value in sorted(funnel.items())},
        'event_counts': dict(event_counts),
        'by_last_cta_source': {
            source: {key: sorted(value) for key, value in sorted(counts.items())}
            for source, counts in sorted(sources.items())
        },
        'conversion_sources': conversion_sources,
        'session_ids': sorted(exposed),
        'limitations': [
            'Page sessions are not unique visitors or simulator visits.',
            'Name focus is automatic and is not evidence of typing.',
            'An active session count does not prove the simulator job is running.',
            'Conversions are attributed to the last recorded CTA, not causal influence.',
        ],
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    parser.add_argument('variant')
    args = parser.parse_args()
    print(json.dumps(summarize(json.loads(args.export.read_text()), args.variant),
                     ensure_ascii=False, indent=2))
