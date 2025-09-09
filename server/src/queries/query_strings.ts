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

export const LINTING = '';
export const HIGHLIGHTING = '';
export const FORMATTING = '';
// export const FORMATTING3 = '';
