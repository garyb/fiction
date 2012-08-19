# Fiction

Yet another lisp in JavaScript.

Reader takes text values and converts them into a objects representing 
s-expressions.

Expander deals with macros. It's almost impossible to debug macros at the 
moment though, and not just due to the lack of macroexpand-1 type access - there 
is also currently no checking that templates are valid for the patterns they are 
associated with. As long as you don't make any mistakes in the macro definition
it does what it should!

Interpreter runs s-exprs directly and returns the result an object that is not 
just a plain JavaScript value - it's an object very similar to the 
reader-produced s-expr representation.

Compiler takes s-exprs and attempts to produce valid JS code. It mostly 
works too.