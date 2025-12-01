(program . [(_) _] @format.remove-prior)

(program [(_) _] @format.newline-after .)

(
    [
        (named_node
            "(" @former
            .
            name: [(_) _] @latter
        )
        (predicate
            .
            "(" @former
            .
            "#" @latter
        )
        (negated_field
            "!" @former
            .
            (identifier) @latter
        )
        (field_definition
            name: (identifier) @former
            .
            ":" @latter
        )
        (_
            [(_) _] @former
            .
            (quantifier) @latter
            (#not-a-comment? @former)
        )
        (_
            [(_) _] @former
            .
            ")" @latter
            (#not-a-comment? @former)
        )
        (_
            "(" @former
            .
            (_ . "(" @latter)
        )
        ]
    (#not-connected? @former @latter)
) @connect-former-to-latter

(
    [
        (
            [(named_node) (anonymous_node)] @space-former
            .
            (comment) @space-latter
            (#on-same-line? @space-former @space-latter)
            )
        (_
            [(_) _] @space-former
            .
            (capture) @space-latter
            (#not-type? @_parent "parameters")
        ) @_parent
        ]
    (#not-spaced? @former @latter)
)

[
    (named_node
        name: [(_) _] @newline-after
        .
        [(_) _] @indent-before
        .
        [(_) _]*
        .
        ")"
    ) @dedent-after
]

(
    (comment)
    .
    [(_) _] @latter
) @newline-before-latter