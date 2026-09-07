# Main and secondary text in admin tables

The location cell in Dnevnik is the spacing reference for names with SKUs, order references, explanatory subtitles, and other primary/secondary table values. Use the shared exports from `@/shared/ui/admin-table`:

- `adminTableTextStackClassName` on the stack: column layout with no extra gap.
- `adminTablePrimaryTextClassName` on the primary line.
- `adminTableSecondaryTextClassName` on each subordinate line.

The global tokens are `--admin-table-primary-line-height: 18.2px` and `--admin-table-secondary-line-height: 15px`. The primary measurement includes the transparent outline used by matching values in Dnevnik. Do not add `mt-*`, `gap-*`, or a separate line height between these lines. Keep existing font sizes, weight, colour, text alignment, indentation, and truncation appropriate to the cell. Let genuinely long descriptions wrap.

For bordered inline-edit fields, use the same total row heights and subtract the border widths from their content line heights. Article identity fields demonstrate this so read and edit modes retain the same positions.

Apply the rule to paired header labels as well as body cells. It does not turn unrelated values (such as several equal-priority phone numbers) or form validation messages into primary/secondary pairs.
