

(program (_)* @child) @program

; (_
;     (_
;         ([_] @former
;         .
;         _ @latter)
;         (#not-match? @former "(^[;\\)\\]@\\.:\?#])|(^[\"\\(\\[]$)")
;         (#not-match? @latter "(^[;\\)\\]@:\?#])|(^[\"\\(\\[]$)")
;         ) @contextual-pair
;         )

; (definition _ @_not-a-comment (capture) @capture (#not-match? @_not-a-comment "^;")) @sub-capture
(capture) @capture

(quantifier) @quantifier

(_ (_ _ @_not-a-comment . (comment) @comment (#not-match? @_not-a-comment "^;"))) @sub-comment

(negated_field "!" @bang . (identifier)) @negated-field


(field_definition name: (identifier) name: ":" @colon) @field-definition


(named_node
    "(" @open ;@indent-after
    ([supertype: (identifier)] . "/" . )?
    name: _ @name
    _* @child
    . ")" @close ;@dedent-before
    ) @named-node ;@indentation-candidate

(list
    "[" @open ;@indent-after
    . _* @child
    . "]" @close ;@dedent-before
) @list ;@indentation-candidate

(grouping
    "(" @open
    _* @child
    .")" @close
    ) @grouping

(predicate
    "(" @open ;@indent-after
    (predicate_type) @predicate-type
    parameters: (parameters _* @parameter)? @parameters
    ")" @close ;@dedent-before
    ) @predicate ;@indentation-candidate

; (definition
;     [
;         ((definition) @former . (definition) @latter)
;         ((definition) @former . "." @latter)
;     ]
;     ) @definition-child-pair
; (named_node name: _ @former . [(definition) (negated_field) "."] @latter . _ . _+ ")") @definition-child-pair
; (named_node name: _ @former . ("."? . (definition))@latter . "."? . ")") @space-pair
; (named_node name: _ . "."? . (definition) @former . "." @latter . ")") @space-pair
; (named_node name: _ . "." @former . (definition) @latter . "."? . ")") @space-pair

; (grouping . "(" @former . (definition) @latter) @grouping-first-pair
; (grouping _ @former . ")" @latter (#not-match? @former "^;")) @grouping-last-pair
; (named_node _ @former . ")" @latter (#not-match? @former "^;")) @named-node-last-pair
; (list . "[" @former . (definition) @latter) @list-first-pair
; (list ([_] @former . "]" @latter) (#not-match? @former "^;")) @list-last-pair
; ; (list
; ;     ("[" (_) @first)
; ;     )
; (named_node
;     name: _ @here
;     . "."? @here
;     . [(definition) (negated_field)] @here
;     . "."? @here
;     . ")" @here
;     ) @spaces-between
; [
;     (predicate 
;         ("(" @former
;         . name: "#" @latter))
;     (predicate
;         ((_) @former
;         . ")" @latter)
;         (#not-match? @former "^;"))
;     (named_node
;         ("(" @former
;         . [(identifier) "_"] @latter))
;     ; (named_node
;     ;     ([name: [(identifier) "_"]] @former
;     ;     . ")" @latter))
;     (field_definition
;         ([name: (identifier) @former]
;         . name: ":" @latter))
;     (negated_field
;         ("!" @former
;         (identifier) @latter))
;     (_
;         (_) @former
;         . (quantifier) @latter
;         (#not-match? @former "^;"))
; ] @connect-pair

; (named_node)

; (_
;     _ @former
;     .
;     (capture) @latter
;     (#not-match? @former "^;")
;     ) @space-pair
    

; [
;     (field_definition
;         ":" @former
;         . (_) @latter
;         )
;     (predicate
;         type: (predicate_type) @former
;         . (parameters) @latter )
;     (parameters
;         _ @former
;         . _ @latter
;         (#not-match? @former "^;")
;         (#not-match? @latter "^@")
;         )
;     ; (definition (["_" (_)] @from . (capture) @to))
; ] @space-pair

; (named_node
;     name: _
;     . (_)
;     . "." @anchor
;     . [(definition) (negated_field)] @after-anchor
;     (#not-match? @after-anchor "^;")) @anchor.leading

; (_(_ _ @before.comment . (comment) @comment) @comment.trailing
; (#not-match? @before.comment "^;"))

; (_(_ (comment) @comment . _ @after.comment)) @comment.leading
; (program _ @before.comment.top-level)
; (program (_) @former . (_) @latter) @top-level-pair
