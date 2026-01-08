import os
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

MODEL_NAME = "vennify/t5-base-grammar-correction"
OUTPUT_DIR = "./local_model"

if __name__ == "__main__":
    print(f"Downloading {MODEL_NAME}...")
    try:
        AutoTokenizer.from_pretrained(MODEL_NAME).save_pretrained(OUTPUT_DIR)
        AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME).save_pretrained(OUTPUT_DIR)
        print(f"Saved to {OUTPUT_DIR}")
    except Exception as e:
        print(f"Error: {e}")
        exit(1)
