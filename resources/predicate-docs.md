# Predicates

## Default Predicates

### `#eq?`

Matches if the text of the captured node is equal to either a specified string literal or the text of another specified capture.

```tree-sitter-query
(#eq? @a-capture "a single string value")
; capture.node.text ?= "a single string value"
```

```tree-sitter-query
(#eq? @first-capture @second-capture)
```
