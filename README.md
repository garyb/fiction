# Fiction

Yet another lisp in JavaScript.

Reader takes text values and converts them into a objects representing 
s-expressions.

Expander doesn't do anything yet apart from strip comments from the s-exprs 
produced by reader... it probably shouldn't even do that. Next up though, the 
expander will deal with macros.

Interpreter runs s-exprs directly and returns a weird value object.

Compiler takes s-exprs and attempts to produce valid JS code. It mostly 
works too.