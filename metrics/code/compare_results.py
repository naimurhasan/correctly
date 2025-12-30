#!/usr/bin/env python3
"""
Compare model output with expected correct answers.
Usage: python compare_results.py <benchmark.json> <model_output.txt> [--output <results.json>]
"""

import json
import argparse

def compare_results(benchmark_file, model_output_file, output_file='comparison_results.json'):
    # Load benchmark data
    with open(benchmark_file, 'r') as f:
        data = json.load(f)

    # Load model output
    with open(model_output_file, 'r') as f:
        model_lines = [line.strip() for line in f.readlines()]

    # Compare and build results
    results = []
    for i, item in enumerate(data):
        model_output = model_lines[i] if i < len(model_lines) else ""
        expected_correct = item['correct']
        is_match = model_output == expected_correct

        result = {
            "sl": item.get('sl', i + 1),
            "incorrect": item['incorrect'],
            "expected_correct": expected_correct,
            "model_output": model_output,
            "match": is_match,
            "category": item.get('category', 'Unknown')
        }
        results.append(result)

    # Calculate stats
    total = len(results)
    matches = sum(1 for r in results if r['match'])
    mismatches = total - matches

    output = {
        "summary": {
            "total": total,
            "matches": matches,
            "mismatches": mismatches,
            "accuracy": round(matches / total * 100, 2) if total > 0 else 0
        },
        "results": results
    }

    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"Comparison complete: {matches}/{total} matches ({output['summary']['accuracy']}% accuracy)")
    print(f"Results written to {output_file}")

    return output

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compare model output with expected corrections')
    parser.add_argument('benchmark', help='Benchmark JSON file (with incorrect/correct fields)')
    parser.add_argument('model_output', help='Model output text file (one sentence per line)')
    parser.add_argument('--output', '-o', default='comparison_results.json', help='Output JSON file')
    args = parser.parse_args()

    compare_results(args.benchmark, args.model_output, args.output)
