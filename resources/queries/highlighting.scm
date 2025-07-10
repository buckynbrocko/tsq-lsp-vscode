
(
    (predicate
        name: (identifier) @_name
        parameters: (parameters
            (string
                "\"" @string.regexp
                (string_content
                    (escape_sequence)* @string.escape
                    )
                "\"" @string.regexp
                )
            )
        )
    (#any-of? @_name "match" "not-match" "any-match" "any-not-match" "vim-match" "not-vim-match" "lua-match" "not-lua-match")
    )

(
    (predicate
        name: (identifier) @_name
        parameters: (parameters
            (identifier) @pattern.built-in
        )
    )
    (#eq? @_name "set")
    (#any-of? @pattern.built-in "injection.language" "injection.combined" "injection.include-children" "injection.self" "injection.parent")
    )


(predicate parameters: (parameters (capture (identifier) @capture-name)))




;(capture (identifier) @capture-name)
(capture name: (identifier) @capture-name)
[
	(capture "@" @hanging-capture . name: (MISSING identifier))
	(ERROR _ @hanging-capture)
	] (#eq? @hanging-capture "@")



;(escape_sequence) @string.escape