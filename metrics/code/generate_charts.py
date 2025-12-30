import json
import matplotlib.pyplot as plt
import numpy as np
import os

# Set style for professional look
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.size'] = 12
plt.rcParams['axes.labelsize'] = 14
plt.rcParams['axes.titlesize'] = 16
plt.rcParams['figure.facecolor'] = 'white'

# Create output directory
output_dir = os.path.join(os.path.dirname(__file__), '..', 'charts')
os.makedirs(output_dir, exist_ok=True)

# Load data
data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')

with open(os.path.join(data_dir, 'correctly_comparison_results.json'), 'r') as f:
    correctly_data = json.load(f)

with open(os.path.join(data_dir, 'grammarly_comparison_results.json'), 'r') as f:
    grammarly_data = json.load(f)

with open(os.path.join(data_dir, 'quilbot_comparison_results.json'), 'r') as f:
    quillbot_data = json.load(f)

with open(os.path.join(data_dir, 'ram_usage.json'), 'r') as f:
    ram_data = json.load(f)

# Colors
COLORS = {
    'correctly': '#22C55E',  # Green
    'grammarly': '#10B981',  # Emerald
    'quillbot': '#6366F1',   # Indigo
}

# 1. Overall Accuracy Bar Chart
def create_overall_accuracy_chart():
    fig, ax = plt.subplots(figsize=(10, 6))

    tools = ['Grammarly', 'QuillBot', 'Correctly']
    accuracies = [64, 63, 40]
    colors = [COLORS['grammarly'], COLORS['quillbot'], COLORS['correctly']]

    bars = ax.barh(tools, accuracies, color=colors, height=0.6, edgecolor='white', linewidth=2)

    # Add value labels
    for bar, acc in zip(bars, accuracies):
        ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
                f'{acc}%', va='center', fontweight='bold', fontsize=14)

    ax.set_xlim(0, 100)
    ax.set_xlabel('Accuracy (%)', fontweight='bold')
    ax.set_title('Overall Grammar Correction Accuracy\n(100 Test Cases)', fontweight='bold', pad=20)

    # Add grid
    ax.xaxis.grid(True, linestyle='--', alpha=0.7)
    ax.set_axisbelow(True)

    # Style
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'overall_accuracy.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("Created: overall_accuracy.png")

# 2. Category Breakdown Grouped Bar Chart
def create_category_breakdown_chart():
    # Calculate accuracy by category for each tool
    categories = [
        'Basic Grammar Errors',
        'Sentence Structure',
        'Prepositions & Conjunctions',
        'Punctuation & Capitalization',
        'Spelling & Grammar',
        'ESL-Style Errors',
        'Formal vs Informal',
        'Meaning Preservation',
        'Mixed Difficulty'
    ]

    # Shortened names for display
    short_names = [
        'Basic Grammar',
        'Sentence Structure',
        'Prepositions',
        'Punctuation',
        'Spelling+Grammar',
        'ESL Errors',
        'Formal/Informal',
        'Meaning Pres.',
        'Mixed Difficulty'
    ]

    def calc_category_accuracy(data, category_name):
        results = data['results']
        category_results = [r for r in results if category_name in r.get('category', '')]
        if not category_results:
            return 0
        matches = sum(1 for r in category_results if r['match'])
        return round(matches / len(category_results) * 100)

    # Map categories
    category_map = {
        'Basic Grammar Errors': 'Basic Grammar Errors',
        'Sentence Structure': 'Sentence Structure and Word Order',
        'Prepositions & Conjunctions': 'Prepositions and Conjunctions',
        'Punctuation & Capitalization': 'Punctuation and Capitalization',
        'Spelling & Grammar': 'Spelling and Grammar Combined',
        'ESL-Style Errors': 'ESL-Style Errors',
        'Formal vs Informal': 'Formal vs Informal Tone',
        'Meaning Preservation': 'Meaning Preservation Stress Test',
        'Mixed Difficulty': 'Mixed Difficulty'
    }

    grammarly_acc = []
    quillbot_acc = []
    correctly_acc = []

    for cat, full_cat in category_map.items():
        grammarly_acc.append(calc_category_accuracy(grammarly_data, full_cat))
        quillbot_acc.append(calc_category_accuracy(quillbot_data, full_cat))
        correctly_acc.append(calc_category_accuracy(correctly_data, full_cat))

    fig, ax = plt.subplots(figsize=(14, 8))

    x = np.arange(len(short_names))
    width = 0.25

    bars1 = ax.bar(x - width, grammarly_acc, width, label='Grammarly', color=COLORS['grammarly'], edgecolor='white', linewidth=1)
    bars2 = ax.bar(x, quillbot_acc, width, label='QuillBot', color=COLORS['quillbot'], edgecolor='white', linewidth=1)
    bars3 = ax.bar(x + width, correctly_acc, width, label='Correctly', color=COLORS['correctly'], edgecolor='white', linewidth=1)

    ax.set_ylabel('Accuracy (%)', fontweight='bold')
    ax.set_title('Grammar Correction Accuracy by Category', fontweight='bold', pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels(short_names, rotation=45, ha='right')
    ax.legend(loc='upper right', framealpha=0.9)
    ax.set_ylim(0, 110)

    # Add value labels on bars
    def add_labels(bars):
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                ax.annotate(f'{int(height)}',
                           xy=(bar.get_x() + bar.get_width() / 2, height),
                           xytext=(0, 3),
                           textcoords="offset points",
                           ha='center', va='bottom', fontsize=9, fontweight='bold')

    add_labels(bars1)
    add_labels(bars2)
    add_labels(bars3)

    ax.yaxis.grid(True, linestyle='--', alpha=0.7)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'category_breakdown.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("Created: category_breakdown.png")

# 3. RAM Usage Comparison
def create_ram_usage_chart():
    fig, ax = plt.subplots(figsize=(10, 6))

    tools = ['Grammarly', 'Correctly', 'QuillBot']
    ram_values = [107, 129, 157]
    colors = [COLORS['grammarly'], COLORS['correctly'], COLORS['quillbot']]

    bars = ax.barh(tools, ram_values, color=colors, height=0.6, edgecolor='white', linewidth=2)

    # Add value labels
    for bar, ram in zip(bars, ram_values):
        ax.text(bar.get_width() + 2, bar.get_y() + bar.get_height()/2,
                f'{ram} MB', va='center', fontweight='bold', fontsize=14)

    ax.set_xlim(0, 200)
    ax.set_xlabel('Memory Usage (MB)', fontweight='bold')
    ax.set_title('Browser Memory Footprint Comparison', fontweight='bold', pad=20)

    ax.xaxis.grid(True, linestyle='--', alpha=0.7)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'ram_usage.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("Created: ram_usage.png")

# 4. Radar Chart - Strengths Comparison
def create_radar_chart():
    categories = ['Basic\nGrammar', 'Sentence\nStructure', 'Prepositions',
                  'Punctuation', 'Spelling', 'ESL\nErrors', 'Mixed']

    # Values (normalized to 0-100)
    grammarly_vals = [90, 50, 70, 60, 70, 80, 90]
    quillbot_vals = [95, 50, 70, 60, 70, 80, 100]
    correctly_vals = [90, 20, 40, 50, 60, 20, 80]

    angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()

    # Close the plot
    grammarly_vals += grammarly_vals[:1]
    quillbot_vals += quillbot_vals[:1]
    correctly_vals += correctly_vals[:1]
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(polar=True))

    ax.plot(angles, grammarly_vals, 'o-', linewidth=2, label='Grammarly', color=COLORS['grammarly'])
    ax.fill(angles, grammarly_vals, alpha=0.15, color=COLORS['grammarly'])

    ax.plot(angles, quillbot_vals, 'o-', linewidth=2, label='QuillBot', color=COLORS['quillbot'])
    ax.fill(angles, quillbot_vals, alpha=0.15, color=COLORS['quillbot'])

    ax.plot(angles, correctly_vals, 'o-', linewidth=2, label='Correctly', color=COLORS['correctly'])
    ax.fill(angles, correctly_vals, alpha=0.25, color=COLORS['correctly'])

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=11)
    ax.set_ylim(0, 100)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels(['20%', '40%', '60%', '80%', '100%'], fontsize=9)

    ax.legend(loc='upper right', bbox_to_anchor=(1.15, 1.1), framealpha=0.9)
    ax.set_title('Grammar Correction Strengths\nby Category', fontweight='bold', pad=20, fontsize=16)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'radar_comparison.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("Created: radar_comparison.png")

# 5. Privacy vs Accuracy Trade-off Chart
def create_tradeoff_chart():
    fig, ax = plt.subplots(figsize=(10, 8))

    # Data points: (privacy_score, accuracy)
    tools = {
        'Grammarly': (20, 64, COLORS['grammarly']),   # Low privacy, high accuracy
        'QuillBot': (25, 63, COLORS['quillbot']),     # Low privacy, high accuracy
        'Correctly': (100, 40, COLORS['correctly']),  # High privacy, lower accuracy
    }

    for tool, (privacy, accuracy, color) in tools.items():
        ax.scatter(privacy, accuracy, s=800, c=color, label=tool, edgecolors='white', linewidth=3, zorder=5)
        ax.annotate(tool, (privacy, accuracy), textcoords="offset points",
                   xytext=(0, 20), ha='center', fontsize=14, fontweight='bold')

    # Add quadrant labels
    ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5)
    ax.axvline(x=50, color='gray', linestyle='--', alpha=0.5)

    ax.text(25, 75, 'Cloud-Based\nHigh Accuracy', ha='center', va='center',
            fontsize=12, alpha=0.6, style='italic')
    ax.text(75, 75, 'Ideal\n(Future Goal)', ha='center', va='center',
            fontsize=12, alpha=0.6, style='italic')
    ax.text(75, 25, 'Privacy-First\nLocal Processing', ha='center', va='center',
            fontsize=12, alpha=0.6, style='italic')

    ax.set_xlim(0, 110)
    ax.set_ylim(0, 100)
    ax.set_xlabel('Privacy Score (Higher = Better)', fontweight='bold', fontsize=14)
    ax.set_ylabel('Accuracy (%)', fontweight='bold', fontsize=14)
    ax.set_title('Privacy vs Accuracy Trade-off', fontweight='bold', pad=20, fontsize=16)

    ax.grid(True, linestyle='--', alpha=0.3)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'privacy_tradeoff.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("Created: privacy_tradeoff.png")

# 6. Pie Chart - Error Distribution
def create_error_distribution_chart():
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    tools_data = [
        ('Grammarly', grammarly_data, COLORS['grammarly']),
        ('QuillBot', quillbot_data, COLORS['quillbot']),
        ('Correctly', correctly_data, COLORS['correctly'])
    ]

    for ax, (name, data, color) in zip(axes, tools_data):
        matches = data['summary']['matches']
        mismatches = data['summary']['mismatches']

        sizes = [matches, mismatches]
        labels = [f'Correct\n({matches})', f'Incorrect\n({mismatches})']
        colors_pie = [color, '#E5E7EB']
        explode = (0.05, 0)

        wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels, colors=colors_pie,
                                           autopct='%1.0f%%', startangle=90,
                                           wedgeprops=dict(edgecolor='white', linewidth=2))

        for autotext in autotexts:
            autotext.set_fontweight('bold')
            autotext.set_fontsize(12)

        ax.set_title(name, fontweight='bold', fontsize=14, pad=10)

    fig.suptitle('Correction Success Rate Distribution', fontweight='bold', fontsize=16, y=1.02)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'success_distribution.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("Created: success_distribution.png")

# 7. Stacked Bar - Detailed Category Performance
def create_stacked_performance_chart():
    fig, ax = plt.subplots(figsize=(12, 7))

    categories = ['Grammarly', 'QuillBot', 'Correctly']

    # Calculate category-wise performance
    basic = [18, 19, 18]  # out of 20
    structure = [5, 5, 2]  # out of 10
    prepositions = [7, 7, 4]  # out of 10
    punctuation = [6, 6, 5]  # out of 10
    spelling = [7, 7, 6]  # out of 10
    esl = [8, 8, 2]  # out of 10
    formal = [0, 0, 0]  # out of 10
    meaning = [5, 3, 2]  # out of 10
    mixed = [9, 10, 8]  # out of 10

    x = np.arange(len(categories))
    width = 0.5

    colors_stack = ['#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
                    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7']

    bottoms = np.zeros(3)
    labels = ['Basic Grammar', 'Structure', 'Prepositions', 'Punctuation',
              'Spelling', 'ESL', 'Formal/Informal', 'Meaning', 'Mixed']
    data_arrays = [basic, structure, prepositions, punctuation, spelling, esl, formal, meaning, mixed]

    for data, label, color in zip(data_arrays, labels, colors_stack):
        ax.bar(x, data, width, label=label, bottom=bottoms, color=color, edgecolor='white', linewidth=0.5)
        bottoms += np.array(data)

    # Add total labels
    for i, total in enumerate(bottoms):
        ax.text(i, total + 1, f'{int(total)}/100', ha='center', fontweight='bold', fontsize=12)

    ax.set_ylabel('Correct Answers', fontweight='bold')
    ax.set_title('Detailed Performance Breakdown\n(Stacked by Category)', fontweight='bold', pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels(categories, fontweight='bold', fontsize=12)
    ax.legend(loc='center left', bbox_to_anchor=(1, 0.5), framealpha=0.9)
    ax.set_ylim(0, 80)

    ax.yaxis.grid(True, linestyle='--', alpha=0.7)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'stacked_performance.png'), dpi=150, bbox_inches='tight')
    plt.close()
    print("Created: stacked_performance.png")

# 8. Architecture Diagram (Simple)
def create_architecture_diagram():
    fig, ax = plt.subplots(figsize=(14, 8))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8)
    ax.axis('off')

    # Boxes
    boxes = [
        (1, 4, 3, 2, 'Content Script\n(Web Page)', '#22C55E'),
        (5.5, 4, 3, 2, 'Service Worker\n(Background)', '#10B981'),
        (10, 4, 3, 2, 'Offscreen Doc\n(ML Engine)', '#6366F1'),
        (10, 1, 3, 1.5, 'T5 Model\n(ONNX Runtime)', '#8B5CF6'),
    ]

    for x, y, w, h, text, color in boxes:
        rect = plt.Rectangle((x, y), w, h, linewidth=2, edgecolor=color,
                             facecolor=color, alpha=0.3, zorder=1)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2, text, ha='center', va='center',
               fontweight='bold', fontsize=11, zorder=2)

    # Arrows
    arrow_style = dict(arrowstyle='->', color='#374151', lw=2)
    ax.annotate('', xy=(5.5, 5), xytext=(4, 5), arrowprops=arrow_style)
    ax.annotate('', xy=(10, 5), xytext=(8.5, 5), arrowprops=arrow_style)
    ax.annotate('', xy=(11.5, 4), xytext=(11.5, 2.5), arrowprops=arrow_style)

    # Labels
    ax.text(4.75, 5.5, 'Text Input', ha='center', fontsize=10, style='italic')
    ax.text(9.25, 5.5, 'Process', ha='center', fontsize=10, style='italic')
    ax.text(12.5, 3.25, 'Inference', ha='center', fontsize=10, style='italic')

    # Title
    ax.text(7, 7.2, 'Correctly Architecture', ha='center', fontweight='bold', fontsize=18)

    # User icon (simple)
    ax.text(0.3, 5, '👤', fontsize=30, ha='center', va='center')
    ax.annotate('', xy=(1, 5), xytext=(0.7, 5), arrowprops=arrow_style)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'architecture.png'), dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    print("Created: architecture.png")

# Generate all charts
if __name__ == '__main__':
    print("Generating charts...")
    print("-" * 40)

    create_overall_accuracy_chart()
    create_category_breakdown_chart()
    create_ram_usage_chart()
    create_radar_chart()
    create_tradeoff_chart()
    create_error_distribution_chart()
    create_stacked_performance_chart()
    create_architecture_diagram()

    print("-" * 40)
    print(f"All charts saved to: {output_dir}")
