[
    (list . "[" @empty-container.open . (comment)* . "]" @empty-container.close)
    (grouping . "(" @empty-container.open . (comment)* . ")" @empty-container.close)
] @empty-container


(anonymous_node name: (MISSING)) @lint.missing-node
(predicate parameters: (parameters . (MISSING identifier) . )) @missing-parameters
(field_definition
        name: (identifier)
        (anonymous_node
            name: (MISSING "_")
            )
        ) @missing-field-value        


(ERROR (_) @lint.error-node) 
[
    (ERROR "@" @hanging-capture .)
    (
        (ERROR _ @lint.error-node)
        (#not-eq? @lint.error-node "@")
        )
]


(predicate name: (identifier) @predicate.name type: (predicate_type) @predicate.type (#eq? @predicate.type "\?")) @lint.predicate
(predicate name: (identifier) @directive.name type: (predicate_type) @predicate.type (#eq? @predicate.type "\!")) @lint.directive


(named_node
    name: [(identifier) "_"] @parent.name
    [
        (named_node)
        (anonymous_node)
        (negated_field)
        (field_definition)
        (list)
        (grouping)
        ]* @subnode
    (negated_field (identifier) @negated-field.name)*
    (field_definition
        name: (identifier) @field.name
        name: ":"
        .
        [
            (named_node)
            (anonymous_node)
            (list)
            (grouping)
            ] @field.value
        )*
    ) @lint.named-node @named-node
