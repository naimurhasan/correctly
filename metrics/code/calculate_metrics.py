#!/usr/bin/env python3
"""
Calculate detailed metrics from comparison results.
Usage: python calculate_metrics.py <comparison_results.json> [--output <metrics.json>]
"""

import json
import argparse
from collections import defaultdict

def calculate_metrics(comparison_file, output_file=None):
    with open(comparison_file, 'r') as f:
        data = json.load(f)

    results = data.get('results', data)
    if isinstance(results, dict):
        results = results.get('results', [])

    # Overall metrics
    total = len(results)
    matches = sum(1 for r in results if r['match'])
    mismatches = total - matches
    accuracy = round(matches / total * 100, 2) if total > 0 else 0

    # Category-wise breakdown
    category_stats = defaultdict(lambda: {'total': 0, 'matches': 0})
    for r in results:
        cat = r.get('category', 'Unknown')
        category_stats[cat]['total'] += 1
        if r['match']:
            category_stats[cat]['matches'] += 1

    category_breakdown = {}
    for cat, stats in category_stats.items():
        cat_accuracy = round(stats['matches'] / stats['total'] * 100, 2) if stats['total'] > 0 else 0
        category_breakdown[cat] = {
            'total': stats['total'],
            'matches': stats['matches'],
            'mismatches': stats['total'] - stats['matches'],
            'accuracy': cat_accuracy
        }

    # Mismatched items for review
    mismatched_items = [r for r in results if not r['match']]

    metrics = {
        'overall': {
            'total': total,
            'matches': matches,
            'mismatches': mismatches,
            'accuracy': accuracy
        },
        'by_category': category_breakdown,
        'mismatched_count': len(mismatched_items),
        'mismatched_items': mismatched_items
    }

    # Print summary
    print("=" * 60)
    print("GRAMMAR CORRECTION METRICS")
    print("=" * 60)
    print(f"\nOverall: {matches}/{total} ({accuracy}%)")
    print("\nBy Category:")
    print("-" * 40)
    for cat, stats in sorted(category_breakdown.items()):
        print(f"  {cat}: {stats['matches']}/{stats['total']} ({stats['accuracy']}%)")
    print("=" * 60)

    if output_file:
        with open(output_file, 'w') as f:
            json.dump(metrics, f, indent=2)
        print(f"\nMetrics saved to {output_file}")

    return metrics

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Calculate detailed metrics from comparison results')
    parser.add_argument('comparison', help='Comparison results JSON file')
    parser.add_argument('--output', '-o', help='Output metrics JSON file (optional)')
    args = parser.parse_args()

    calculate_metrics(args.comparison, args.output)
