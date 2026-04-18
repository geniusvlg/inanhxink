# Claude Working Rules

## Memory

- When asked to "remember" something, save it in **both** Serena memory and a relevant file in `docs/`

## Tools

- Prefer Serena symbolic tools (`get_symbols_overview`, `find_symbol`, `replace_symbol_body`, `insert_after_symbol`) over full file reads
- Only fall back to `Read`/`Edit` for files with no symbols (HTML, CSS, plain text)
