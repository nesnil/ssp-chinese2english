#!/usr/bin/env bash
set -euo pipefail

result_dir="${1:-result}"
out_file="${2:-$result_dir/C2E-S1.md}"

cat \
  "$result_dir/Day1.md" \
  "$result_dir/Day2.md" \
  "$result_dir/Day3.md" \
  "$result_dir/Day4.md" \
  "$result_dir/Day5.md" \
  "$result_dir/Day6.md" \
  "$result_dir/Day7.md" \
  "$result_dir/Day8.md" \
  "$result_dir/Day9.md" \
  "$result_dir/Day10.md" \
  > "$out_file"

echo "Merged to: $out_file"
