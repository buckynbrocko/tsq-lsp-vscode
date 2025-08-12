    (_ (program)
        @indent-after

        @not-a-comment
        @named-node
        @not-a-bracket
        @__
        @not-a-paren
        @___
        @list
        @dedent-after
        )


(list
    . "[" @indent-after
    [
        (comment)
        (_ . _+)
    ] .
    "]" @dedent-after
) @list

(list
    . "[" @cancel-indent-after
    . (anonymous_node)
    . "]" @cancel-dedent-after
    ) @list.cancel


(grouping "(" @indent-after ")" @dedent-after)

    (named_node
        ."(" @indent-after
        [
            (comment)
            ((_) (_)+)
            ]
        ")" @dedent-after
    ) @named-node

    ; (named_node

    ;     . ("(" @indent-after
    ;     ; (supertype: _?)?
    ;      name: _
    ;     . _ @not-a-paren-comment
    ;     .  _ @not-a-paren-comment)
    ;     ")" @dedent-after
    ; 	(#not-match? @not-a-paren-comment "(^;)|(^\\)$)")
    ; ) @named-node