(predicate
    name: (identifier) @_name

    (predicate_type) @predicate-type

    parameters: (parameters
        (identifier) @pattern.built-in
    )
)
    (#eq? @_name "set")
    (#eq? @predicate-type "!")
    (#any-of? @pattern.built-in "injection.language" "injection.combined" "injection.include-children" "injection.self" "injection.parent")


; (predicate parameters: (parameters (capture (identifier) @capture-name)))




;(capture (identifier) @capture-name)
(capture name: (identifier) @capture-name)




;(escape_sequence) @string.escape