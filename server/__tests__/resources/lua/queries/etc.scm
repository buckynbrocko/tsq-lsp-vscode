
(label_statement "::" "::")

(chunk (comment) (comment))

field: (identifier) @field

  (attribute
    "<" @punctuation.bracket
    (identifier) @attribute
    ">" @punctuation.bracket)

name: (identifier) @field

(dot_index_expression field: (identifier) @field)

name: [
    (identifier) @function
    (dot_index_expression
      field: (identifier) @function)
  ]

name: (method_index_expression
    method: (identifier) @method)

method: (identifier) @method

(variable_list .
    name: [
      (identifier) @function
      (dot_index_expression
        field: (identifier) @function)
    ])

name: [
      (identifier) @function
      (dot_index_expression
        field: (identifier) @function)
    ]

(dot_index_expression
        field: (identifier) @function)

(expression_list .
    value: (function_definition))

(assignment_statement
  (variable_list .
    name: [
      (identifier) @function
      (dot_index_expression
        field: (identifier) @function)
    ])
  (expression_list .
    value: (function_definition)))

(table_constructor
  (field
    name: (identifier) @function
    value: (function_definition)))

(function_call
  name: [
    (identifier) @function.call
    (dot_index_expression
      field: (identifier) @function.call)
    (method_index_expression
      method: (identifier) @method.call)
  ])

  name: [
    (identifier) @function.call
    (dot_index_expression
      field: (identifier) @function.call)
    (method_index_expression
      method: (identifier) @method.call)
  ]

(dot_index_expression
    field: (identifier) @function.call)

  (method_index_expression
      method: (identifier) @method.call)

method: (identifier)

(chunk (statement) (statement) (return_statement))

(chunk (comment))

(do_statement "do" body: (_))

(do_statement "do" !body)

(do_statement !body "do")