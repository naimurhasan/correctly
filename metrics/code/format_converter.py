#!/usr/bin/env python3
"""
Convert between different formats for grammar benchmark data.
Usage:
  python format_converter.py json2txt <input.json> --output-dir <dir>
  python format_converter.py txt2json <incorrect.txt> <correct.txt> --output <output.json>
  python format_converter.py json2csv <input.json> --output <output.csv>
"""

import json
import csv
import argparse
import os

def json_to_txt(input_file, output_dir='.'):
    """Convert JSON benchmark to text files."""
    with open(input_file, 'r') as f:
        data = json.load(f)

    incorrect_file = os.path.join(output_dir, 'incorrect_output.txt')
    correct_file = os.path.join(output_dir, 'correct_output.txt')

    with open(incorrect_file, 'w') as out:
        for item in data:
            out.write(item['incorrect'] + '\n')

    with open(correct_file, 'w') as out:
        for item in data:
            out.write(item['correct'] + '\n')

    print(f"Converted {len(data)} items to TXT")
    print(f"  {incorrect_file}")
    print(f"  {correct_file}")

def txt_to_json(incorrect_file, correct_file, output_file, category='Unknown'):
    """Convert text files to JSON benchmark format."""
    with open(incorrect_file, 'r') as f:
        incorrect_lines = [line.strip() for line in f.readlines()]

    with open(correct_file, 'r') as f:
        correct_lines = [line.strip() for line in f.readlines()]

    if len(incorrect_lines) != len(correct_lines):
        print(f"Warning: Line count mismatch ({len(incorrect_lines)} vs {len(correct_lines)})")

    data = []
    for i, (inc, cor) in enumerate(zip(incorrect_lines, correct_lines), 1):
        data.append({
            'sl': i,
            'incorrect': inc,
            'correct': cor,
            'category': category
        })

    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Converted {len(data)} items to JSON: {output_file}")

def json_to_csv(input_file, output_file):
    """Convert JSON benchmark to CSV."""
    with open(input_file, 'r') as f:
        data = json.load(f)

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['sl', 'incorrect', 'correct', 'category'])
        writer.writeheader()
        for item in data:
            writer.writerow({
                'sl': item.get('sl', ''),
                'incorrect': item['incorrect'],
                'correct': item['correct'],
                'category': item.get('category', '')
            })

    print(f"Converted {len(data)} items to CSV: {output_file}")

def csv_to_json(input_file, output_file):
    """Convert CSV to JSON benchmark format."""
    data = []
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            data.append({
                'sl': int(row.get('sl', i)),
                'incorrect': row['incorrect'],
                'correct': row['correct'],
                'category': row.get('category', 'Unknown')
            })

    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Converted {len(data)} items to JSON: {output_file}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Convert grammar benchmark formats')
    subparsers = parser.add_subparsers(dest='command', help='Conversion type')

    # json2txt
    p1 = subparsers.add_parser('json2txt', help='JSON to TXT files')
    p1.add_argument('input', help='Input JSON file')
    p1.add_argument('--output-dir', '-o', default='.', help='Output directory')

    # txt2json
    p2 = subparsers.add_parser('txt2json', help='TXT files to JSON')
    p2.add_argument('incorrect', help='Incorrect sentences file')
    p2.add_argument('correct', help='Correct sentences file')
    p2.add_argument('--output', '-o', default='benchmark.json', help='Output JSON file')
    p2.add_argument('--category', '-c', default='Unknown', help='Category for all items')

    # json2csv
    p3 = subparsers.add_parser('json2csv', help='JSON to CSV')
    p3.add_argument('input', help='Input JSON file')
    p3.add_argument('--output', '-o', default='benchmark.csv', help='Output CSV file')

    # csv2json
    p4 = subparsers.add_parser('csv2json', help='CSV to JSON')
    p4.add_argument('input', help='Input CSV file')
    p4.add_argument('--output', '-o', default='benchmark.json', help='Output JSON file')

    args = parser.parse_args()

    if args.command == 'json2txt':
        os.makedirs(args.output_dir, exist_ok=True)
        json_to_txt(args.input, args.output_dir)
    elif args.command == 'txt2json':
        txt_to_json(args.incorrect, args.correct, args.output, args.category)
    elif args.command == 'json2csv':
        json_to_csv(args.input, args.output)
    elif args.command == 'csv2json':
        csv_to_json(args.input, args.output)
    else:
        parser.print_help()
