export const ANY_NODE = `[(_) _ (ERROR) (MISSING)] @node`;
export const ANY_NAMED_NODE = `(_) @node`;
export const ANY_UNNAMED_NODE = `_ @node`;
export const NAMED_NODE_NAMES = `(named_node name: (identifier) @name)`;
export const ERROR_NODES = `(ERROR) @node`;
export const MISSING_NODES = `(MISSING) @node`;
export const MISSING_IDENTIFIER = `(MISSING) @missing-identifier`;
export const FIELDS = `(named_node name: (identifier) @parent-name (field_definition name:(identifier) @field-name (_ name:(identifier)@field-value )?)?)`;
export const NEGATED_FIELDS = `(named_node name: (identifier) @parent-name (negated_field (identifier) @field-name) @negated-field)`;
export const PREDICATE_NAMES = `(predicate name: (identifier) @predicate.name type: (predicate_type) @predicate.type (#eq? @predicate.type "\?"))`;
export const CAPTURE_NAMES = `(capture name: (identifier) @capture-name) @capture`;
export const CHILD_NODES = `(named_node name: (identifier) @parent.name (named_node name: (identifier) @child.name) )`;
// export const LintNamedNodes = `
// (named_node
//     name: (identifier) @parent.name
//     (named_node name: [(identifier) (_) _] @child.name)*
//     (anonymous_node [(string) "_"] @child.name)*
//     (negated_field (identifier) @negated-field.name)*
//     (field_definition
//         name: (identifier) @field.name
//         [
//             (_ name: [(identifier) (string)] @field.value)
//             (anonymous_node "_") @field.value
//         ]?
//         )*
//     )
// `;
export const LINTING = ''; /* `
(ERROR (_) @lint.error-node) 
(
    (ERROR _ @lint.error-node)
    (#not-eq? @lint.error-node "@")
)

[
    ;(missing_node name: (identifier) @missing.name)
    ;(field_definition (anonymous_node name: (MISSING "_") @missing.name))
    (anonymous_node name: (MISSING))
    ;(MISSING "_")
    ] @lint.missing-node

    (field_definition
        name: (identifier)
        (anonymous_node
            name: (MISSING "_")
            )
        ) @lint.missing.field.value

    (
        (ERROR _ @lint.hanging-capture)
        (#eq? @lint.hanging-capture "@")
        )

(predicate name: (identifier) @predicate.name type: (predicate_type) @predicate.type (#eq? @predicate.type "\?")) @lint.predicate

(predicate name: (identifier) @directive.name type: (predicate_type) @predicate.type (#eq? @predicate.type "\!")) @lint.directive

(predicate type: (predicate_type) @predicate.type (#eq? @predicate.type "\?") (parameters . (MISSING identifier) . )) @lint.predicate.parameters.missing

(predicate type: (predicate_type) @predicate.type (#eq? @predicate.type "\!") (parameters . (MISSING identifier) . )) @lint.directive.parameters.missing

(named_node
    name: [(identifier) "_"] @parent.name
    [
        (named_node)
        (anonymous_node)
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
    ) @lint.named-node
`; */

export const HIGHLIGHTING = ''; /* `
(
    (predicate
        name: (identifier) @_name
        parameters: (parameters
            (string
                "\\"" @string.regexp
                (string_content
                    (escape_sequence)* @string.escape
                    )
                "\\"" @string.regexp
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
`; */
