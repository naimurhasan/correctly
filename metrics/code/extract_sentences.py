#!/usr/bin/env python3
"""
Extract incorrect and correct sentences from a grammar benchmark JSON file.
Usage: python extract_sentences.py <input.json> [--output-dir <dir>]
"""

import json
import argparse
import os

def extract_sentences(input_file, output_dir='.'):
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

    print(f"Extracted {len(data)} sentences")
    print(f"  Incorrect: {incorrect_file}")
    print(f"  Correct: {correct_file}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Extract sentences from grammar benchmark JSON')
    parser.add_argument('input', help='Input JSON file (with incorrect/correct fields)')
    parser.add_argument('--output-dir', '-o', default='.', help='Output directory for text files')
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    extract_sentences(args.input, args.output_dir)
