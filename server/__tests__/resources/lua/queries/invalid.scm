(label_statement "::" "::" _)
(label_statement "::" "::" (_))

(chunk (return_statement) (comment))

(chunk (hash_bang_line) (hash_bang_line))

(chunk (statement) (hash_bang_line))

(chunk (return_statement) (statement))

(return_statement ";" ";")

(attribute _ "<")

(chunk (comment) (hash_bang_line))

(chunk (comment) . (hash_bang_line))

(chunk . (comment) . (hash_bang_line))

(chunk (return_statement) . (comment))

(chunk (return_statement) (comment) .)

(chunk name: _)

(hash_bang_line _)

(do_statement body: (_) "do")