# Fiction

Yet another Lisp in JavaScript.

There are still quite a lot of things to be done. Also there are no proper 
tests at the moment, just the stuff in `./playground/`, but that's not a real 
test setup.

It can be run in the browser by poking around with the files in `./playground`, 
or the reader/expander/compiler pipeline can be run with node.js using:

> `node ./src/js/main.js <input> <output>`

Where `<input>` is the path to a `.fic` file, and `<output>` is the path to a 
file to write the compiled JavaScript.

---

## The language

Fiction is a [Scheme][scheme]-like Lisp that compiles down to JavaScript.

Although syntactically using s-expressions the language does not use the 
standard `cons` based data structure to represent expressions, instead 
JavaScript arrays are used. For most practical purposes this doesn't matter, 
aside from the fact it is not possible to create non-list expressions, such as 
`(a . b)`. This is something I might address later though.

### Basic syntax

All syntax items are either literals, or lists. Literals can be strings 
(delimited by double quotes), numbers (either as decimals or hexadecimal of the 
form `0xN`), booleans (`#t` for `true` and `#f` for `false`), or symbols.

Symbols are used as identifiers in the language. They're variable names, 
function names, special form names, etc. They can also be constructed and used 
as runtime values by using the `quote` or `quasiquote` special form, for 
example, `'foo`. Symbol values currently can contain any unicode character that 
is not whitespace, quotes, commas, semicolons, parenthesis, square brackets, or 
braces.

Lists are surrounded by parentheses, and are interpreted as expressions to be 
evaluated, unless appearing inside a `quote` or `quasiquote` special form. For 
example, the list `(foo 10 20)` would call `foo` with the arguments `10` and 
`20`. `foo` could be a special form, a macro, or an identifier for a variable 
containing a function.

Special forms are the core operations provided by the language that cannot be 
expressed as normal functions (like `var`, `if`, and so on). Macros are 
operations defined by the programmer that cannot be expressed as normal 
functions (like `and`). Functions are... well, functions.

Everything in the language is an expression, so even things like `var` that are 
statements in JavaScript return a value. This also means there is no need for a 
`return` statement, because the last value in a function is taken instead.

One slight special case to enable better interop with JavaScript is identifiers 
starting with `.` are only available as object properties.

### Special forms

**Variable declarations**

>_syntax_: `(var <id> <expr>)`

Declares a new variable with the name `<id>` in the current scope and assigns 
it the value that `<expr>` evaluates to.

**Assignments**

> _syntax_: `(set! <id> <expr>)`  
> _syntax_: `(set! <obj-prop> <expr>)`

Assigns the value that `<expr>` evaluates to to variable `<id>` or object 
property `<obj-prop>`. See below for details about the syntax for object 
properties.

**Conditionals**

> _syntax_: `(if <test> <then> <else>)`

Evaluates `<test>`, if the result is true according to JavaScript (not using 
strict equality), `<then>` is evaluated, otherwise `<else>` is.

**Quoting**

> _syntax_: `(quote <datum>)`  
> _syntax_: `'<datum>`

Produces `<datum>` without evaluating it.

**Quasiquoting**

> _syntax_: `(quasiquote <qqtemplate>)`  
> _syntax_: ``<qqtemplate>`

Evaluates `<qqtemplate>` to produce a `datum`-like value, evaluating any 
`unquote` or `unquote-splicing` expressions contained within.

> _syntax_: `(unquote <expr>)`  
> _syntax_: `,<expr>`

Evaluates the expression `<expr>` and inserts it in place of the `unquote` 
expression in the `<qqtemplate>`. Using `unquote` outside of a `quasiquote` 
will raise an error.

> _syntax_: `(unquote-splicing <list-expr>)`  
> _syntax_: `,@<list-expr>`

Evaluates the expression `<list-expr>` that returns a list, and inserts it 
inline in a  place of the `unquote-splicing` expression in the `<qqtemplate>`. 
Using `unquote-splicing` outside of a `list` inside a `quasiquote` will raise 
an error. If `list-expr` does not return a list a runtime error might occur (it 
depends on how JavaScript interprets the value of `<list-expr>` when passed to 
`Array.concat()`).

**Import**

> _syntax_: `(import <name ...>)`

Loads the contents of one or more `.fic` files, specified in the list of 
strings `<name ...>` and splices them in at the current position. The `.fic` 
extension should be omitted from the `<name ...>` items. Can be used almost 
anywhere in a script. There is no specific limit to the number of times the 
same file can be imported, although recursive imports will be ignored.

**Macros**

> _syntax_: `(define-syntax <syntax-id> <transformer>)`  
> _transformer syntax_: `(syntax-rules (<reserved-id ...>) <rule ...>)`  
> _rule syntax_: `((<syntax-id> <pattern>) <template>)`  
> _pattern syntax_: `<id>`  
> _pattern syntax_: `<literal>`  
> _pattern syntax_: `(<pattern ...>)`  
> _pattern syntax_: `<pattern> ...`  
> _template syntax_: `<expr>`  
> _template syntax_: `<template> ...`  
> _template syntax_: `(... ...)`

They're supposed to work as defined in [R5RS][r5rs], more or less. I've not 
tested them thoroughly enough to be sure yet, but they're definitely usable. I 
also need to take some time to write a decent usage description!

[scheme]: http://en.wikipedia.org/wiki/Scheme_%28programming_language%29
[r5rs]: http://www.schemers.org/Documents/Standards/R5RS/
