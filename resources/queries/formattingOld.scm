
(program
    .
    (_) @format.remove-prior
    )

(program
    (_) @format.newline-after
    .
    )

([
    (named_node
        "(" @former
        .
        [(identifier) "_"] @latter )
    (predicate
        .
        "(" @former
        .
        "#" @latter)
    (negated_field
        "!" @former
        .
        (identifier) @latter)
    (field_definition
        name: (identifier) @former
        .
        ":" @latter)
    (_
        [(_) _] @former
        .
        (quantifier) @latter
        (#not-a-comment? @former))
    (_
        [(_) _] @former
        .
        ")" @latter
        (#not-a-comment? @former))
    (_
        "(" @former
        .
        (_
            .
            "(" @latter))
]
    (#not-connected? @former @latter)
) @connect-former-to-latter

([
    ([(named_node) (anonymous_node)] @space-former
    .
    (comment) @space-latter
    (#on-same-line? @space-former @space-latter))
    ((_
        (_)*
        .
        (_) @space-former
        .
        (capture) @space-latter
        ) @_parent
        (#not-type? @_parent "parameters")
        )
]
    (#not-spaced? @former @latter))

[
    (named_node
        name: (_) @newline-after
        .
        (_) @indent-before
        .
        (_)*
        .
        ")" 
        ) @dedent-after
] 

(
    (comment) @newline-after
    .
    _ @after
)