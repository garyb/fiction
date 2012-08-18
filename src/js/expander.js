/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util", "syntax"], function (util, syntax) {

    "use strict";
    
    var checkForm = util.checkForm;
    var createForm = util.createForm;
    
    // TODO: expander needs to perform identifier remapping instead of waiting 
    // until the compile stage - this is necessary to maintain macro hygiene 
    // when free identifiers are used in macro templates, as free identifiers 
    // need to refer to the identifier in the macro's scope:
    // e.g. if macro `m1` is rewritten to `a`:
    // (var a 50)
    // (m1); = 50
    // (let ((a 1000)) (m1)) ; still = 50
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    // ------------------------------------------------------------------------
    //  Expand transforms
    // ------------------------------------------------------------------------
    
    function expandImport(atoms, form, imp, k) {
        expandNextImport(atoms, form, [], imp, k);
    }
    
    function expandNextImport(atoms, form, result, imp, k) {
        while (atoms.length > 0 && imp.done.hasOwnProperty(atoms[0].value)) {
            atoms.shift();
        }
        if (atoms.length === 0) {
            k(result);
        } else {
            imp.handleImport(atoms[0].value, function (tail) {
                imp.done[atoms[0].value] = true;
                expandNextImport(atoms.slice(1), form, result.concat(tail), imp, k);
            });
        }
    }
    
    function expandQuote(atoms, form, imp, k) {
        k([form]);
    }
    
    function expandQuasiQuote(atoms, form, imp, k) {
        expandQuasiQuoteValue(atoms[0], imp, function (value) {
            k(createForm("list", [createForm("symbol", "quasiquote"), value]));
        });
    }
    
    function expandQuasiQuoteValue(form, imp, k) {
        if (form.type !== "list") {
            k(form);
        } else {
            if (checkForm(form, "unquote") || checkForm(form, "unquote-splicing")) {
                var sym = form.value[0];
                expand(form.value[1], imp, function (es) {
                    k(createForm("list", [sym].concat(es)));
                });
            } else {
                expandQuasiQuoteValues(form.value, [], imp, function (es) {
                    k(createForm("list", es));
                });
            }
        }
    }
    
    function expandQuasiQuoteValues(forms, result, imp, k) {
        if (forms.length === 0) {
            k(result);
        } else {
            expandQuasiQuoteValue(forms[0], imp, function (e) {
                expandQuasiQuoteValues(forms.slice(1), result.concat([e]), imp, k);
            });
        }
    }
    
    /*function expandDefineSyntax(atoms, imp, k) {
        // TODO: require that free identifiers in templates have already been declared to ensure predictable expansion
        var id = getSymbolValue(atoms[0]);
        var rules = atoms[1];
        var reserved = atoms[1].value[1].value.map(getSymbolValue);
        
        console.log(id, reserved);
        rules = rules.value.slice(2);
        
        for (var i = 0, l = rules.length; i < l; i++) {
            var rule = rules[i];
            var pattern = rule.value[0];
            var template = rule.value[1];
            console.log("pat:", util.printPretty(pattern));
            console.log("tem:", util.printPretty(template));
        }
        
        k([]);
    }*/
    
    // ------------------------------------------------------------------------
    //  Main
    // ------------------------------------------------------------------------
    
    var expanders = {
        "import": expandImport,
        "quote": expandQuote,
        "quasiquote": expandQuasiQuote
        //"define-syntax": expandDefineSyntax
    };

    function expand(form, imp, k) {
        if (form.type === "list" && form.value.length > 0) {
            var car = form.value[0];
            var cdr = form.value.slice(1);
            if (car.type === "symbol") {
                var syntaxCheck = syntax.checks[car.value];
                if (syntaxCheck) {
                    syntaxCheck(cdr, form);
                }
                var expander = expanders[car.value];
                if (expander) {
                    expander(cdr, form, imp, k);
                    return;
                }
            }
            expandAll(form.value, [], imp, function (result) {
                k(createForm("list", result));
            });
        } else {
            k(form);
        }
    }
    
    function expandAll(seq, result, imp, k) {
        if (seq.length === 0) {
            k(result);
        } else {
            expand(seq[0], imp, function (e) {
                expandAll(seq.slice(1), result.concat(e), imp, k);
            });
        }
    }
    
    function expandScript(forms, handleImport, k) {
        expandAll(forms, [], { done: {}, handleImport: handleImport }, k);
    }

    return { expand: expandScript };

});