/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global require, $*/
require(["playground", "reader", "expander", "util"], function (playground, reader, expander, util) {

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
    
    function expand(name, input, k) {
        run(name, input, function (x, k) {
            expander.expand(reader.read(x), handleImport, function (result) {
                trace("output", x, "=", result.map(util.printPretty).join(" "));
                k();
            });
        }, k);
    }
    
    window.onload = function () {

        var t = new Date().getTime();
        
        var things = [];

        things.push(["symbols", ["a", ".length"]]);
        things.push(["literals", ["5", "5.2", "0xFF", '"word"']]);
        things.push(["comments", ["; sup?"]]);
        
        things.push(["1-item paren list", "(a)"]);
        
        things.push(["comments in lists", ["(do\n;some\nthing)"]]);
        
        things.push(["quote", ["'1", "'()", "'a", "'(1 2 3)", "'(fn () 10)", "''(1 2 3)"]]);
        things.push(["quasiquote & unquote", ["(var a 10) `(1 ,a)", "(var a 10) `(1 '(2 ,a))", "(var a 10) (var b '(2 ,a)) `(1 ,b)", "`(1 ,'(2 3) 4)"]]);
        things.push(["unquote-splicing", ["`(1 ,@'(2 3) 4)", "`(,@'(5))", "`(1 ,@'() 4)", "(var a '(1 2)) `(5 ,@a)"]]);
        
        things.push(["imports", ["(import \"import-test\")", 
                                 "(import \"import-test\" \"import-test\")", 
                                 "(import \"import-test\") (import \"import-test\")",
                                 "'(import \"import-test\")",
                                 "`(import \"import-test\")",
                                 "`a",
                                 "`,(import \"import-test\")",
                                 "`(,@(import \"import-test\"))",
                                 "`('(,(import \"import-test\")))",
                                 "`(,'((import \"import-test\")))"]]);    
                                 
        things.push(["chain imports", ["(import \"chain-import-test\")"]]);
        things.push(["recursive imports", ["(import \"recursive-import-test\")", "(import \"recursive-import-test-a\")"]]);
        
        things.push(["variable numbering", ["(var a 0) a", "(var a 100) (var a 200) a"]]);
        
        things.push(["variable & argument numbering", ["(var a 100) (var a 200) (fn (a) a) a (fn a a) a"]]);
        
        things.push(["special form redefinition", ["(var set! (fn (x) `(bad-idea ,x))) (set! 100)",
                                                   "(var test (fn (set!) (set! 100))) (test (fn (x) x))"]]);
        
        things.push(["macros", ["(import \"macros-1\") (do! 1) (do! 1 2 3)",
                                "(import \"macros-2\") (do 1) (do 1 2 3)",
                                "(import \"macros-3\") (let1 ((a 1)) `(,a))",
                                "(import \"macros-4\") (let ((a 1) (b 2) (c 3)) `(,a ,b ,c))",
                                "(import \"macros-5\") (mc (1 2 3) (a b c))",
                                "(import \"macros-6\") (<++ 1 2 3 4)",
                                "(import \"macros-6\") (++> 1 2 3 4)"]]);    
                                
        things.push(["properties", ["(.sin Math)", 
                                    ".sin", 
                                    "(set! (.foo window) 100)",
                                    "(. window \"document\")",
                                    "(.max Math 10 20 30)",
                                    "(var a '(1 2 3)) (. a 0)"]]);
                                    
        things.push(["objects", ["(obj)", 
                                 "(obj (a 1) (b 2))",
                                 "(obj (a (+ 1 2)))"]]);
        
        var runThings = function () {
            if (things.length > 0) {
                var params = things.shift();
                expand.apply(null, params.concat([runThings]));
            } else {
                trace("status", "It's all good.", new Date().getTime() - t, "ms.");
                scrollTo(0, window.innerHeight);
            }
        };
        
        runThings();
    };    
});