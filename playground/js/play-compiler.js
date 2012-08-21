/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global require, $*/
require(["playground", "reader", "expander", "compiler"], function (playground, reader, expander, compiler) {

    "use strict";
    
    var trace = playground.trace;
    var run = playground.run;
    
    function handleImport(name, k) {
        $.ajax({
            url: "fic/" + name + ".fic",
            dataType: "text",
            success: function (data) {
                k(reader.read(data));
            },
            error: function () {
                throw arguments[2];
            }
        });
    }
    
    function compile(name, input, k) {
        run(name, input, function (x, k) {
            expander.expand(reader.read(x), handleImport, function (result) {
                /*jshint evil: true*/
                var js = compiler.compile(result, { window: "window" }).replace(/\n/g, "\n    ");
                trace("output", x, "=", "\n    " + js + "\n" + prettyPrint(eval(js)) + "\n");
                k();
            });
        }, k);
    }
    
    function prettyPrint(value) {
        if (value === undefined) {
            return "undefined";
        }
        if (value === null) {
            return "null";
        }
        if (Array.isArray(value)) {
            var items = [];
            for (var i = 0, l = value.length; i < l; i++) {
                items[i] = prettyPrint(value[i]);
            }
            return "[" + items.join(", ") + "]";
        }
        if (typeof value === "string") {
            return '"' + value + '"';
        }
        return value.toString();
    }
    
    window.onload = function () {

        var t = new Date().getTime();
        var compiles = [];

        compiles.push(["test", "#t"]);
        compiles.push(["literals", ["5", "5.2", "0xFF", '"hello"', "#t"]]);
        compiles.push(["variables", ["(var a 500) a", "(var a \"one\") (var a \"two\") (var a1 'f) (var a \"three\") (fn (a) a) a"]]);
        
        compiles.push(["function defs", ["(fn () 5)", "(fn (x) x)", "(fn (x y) y)", "(fn x x)", "(fn x (var x 5))"]]);
        compiles.push(["function application", ["(var id (fn (x) x)) (id 5)", "(var id-args (fn x x)) (id-args 1 2 3)"]]);
        
        compiles.push(["cons car cdr", "(var cons (fn (x y) (fn (m) (m x y)))) (var car (fn (z) (z (fn (p q) p)))) (var cdr (fn (z) (z (fn (p q) q)))) (car (cdr (cons 1 (cons 2 3))))"]);
        
        compiles.push(["assignment", "(var a 500) (set! a 1) a"]);
        
        compiles.push(["if", ["(if 1 #t #f)", "(if 0 #t #f)", "(if '() #t #f)", "(if (fn () 4) #t #f)"]]);
        
        compiles.push(["quote", ["'1", "'()", "'a", "'(1 2 3)", "'(fn () 10)", "''(1 2 3)", "'(a)"]]);
        compiles.push(["quasiquote & unquote", ["(var a 10) `(1 ,a)", "(var a 10) `(1 '(2 ,a))", "(var a 10) (var b '(2 ,a)) `(1 ,b)", "`(1 ,'(2 3) 4)"]]);
        compiles.push(["unquote-splicing", ["`(1 ,@'(2 3) 4)", "`(,@'(5))", "`(1 ,@'() 4)", "(var a '(1 2)) `(5 ,@a)"]]);
        
        compiles.push(["importing", ["(import \"import-test\") (id 5)"]]);
        
        compiles.push([".access", ["((.sin Math) 26)", "(set! (.foo window) 100) (.foo window)"]]);
        
        compiles.push(["operators", ["(var a 0) (++ a)", "(== 10 20)", "(! #f)", "(~ 36)", "(<= 10 20)"]]);
        
        compiles.push(["eh", ["(import \"macros-2\") (var id 0) (fn () (++ id))",
                              "(import \"macros-2\") (var genID (do (var id 0) (fn () (++ id)))) `(,(genID) ,(genID))"]]);
                              
        compiles.push(["properties", ["(.sin Math)", 
                                      "(set! (.foo window) 100)",
                                      "(. window \"document\")",
                                      "(. window 'document)",
                                      "(var a '(1 2 3)) (. a 0)"]]);
                                      
        compiles.push(["objects", ["(obj)", 
                                   "(obj (a 1) (b 2))",
                                   "(obj (a (+ 1 2)))"]]);
        
        var runCompiles = function () {
            if (compiles.length > 0) {
                var params = compiles.shift();
                compile.apply(null, params.concat([runCompiles]));
            } else {
                trace("status", "It's all good.", new Date().getTime() - t, "ms.");
                scrollTo(0, document.body.scrollHeight);
            }
        };
        
        runCompiles();
    };    
});