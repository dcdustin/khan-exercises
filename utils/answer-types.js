(function() {

var inexactMessages = {
	unsimplified: "Your answer is almost correct, but it needs to be simplified.",
	missingPercentSign: "Your answer is almost correct, but it is missing a <code>\\%</code> at the end."
};

Khan.answerTypes = Khan.answerTypes || {};

jQuery.extend( Khan.answerTypes, {
	text: function( solutionarea, solution, fallback, verifier, input ) {
		if ( !input ) {
			input = jQuery('<input type="text">');
		}
		
		jQuery( solutionarea ).append( input );

		var correct = typeof solution === "object" ? jQuery( solution ).text() : solution;

		if ( verifier == null ) {
			verifier = function( correct, guess ) {
				correct = jQuery.trim( correct );
				guess = jQuery.trim( guess );
				return correct === guess;
			};
		}

		var ret = function() {
			// we want the normal input if it's nonempty, the fallback converted to a string if
			// the input is empty and a fallback exists, and the empty string if the input
			// is empty and the fallback doesn't exist.
			var val = input.val().length > 0 ?
				input.val() :
				(typeof fallback !== "undefined") ?
					fallback + "" :
					"";

			ret.guess = input.val();

			return verifier( correct, val );
		};
		ret.solution = jQuery.trim( correct );
		ret.examples = verifier.examples || [];
		ret.showGuess = function( guess ) {
			input.val( guess );
		};
		return ret;
	},


	line: function( solutionarea, solution, fallback ) {

		var verifier = function( correct, guess ){
			var result = true;
			for ( i = 0; i < 5; i++ ){
				var sampleX = KhanUtil.randRange( -100, 100 );
				if ( guess.match(/[A-W]|[a-w]|[y-z]|[Y-Z]/) !== null ){
					return false;
				}

				var newGuess = guess
						.replace( /\u2212/, "-" )
						.replace( /(\d)(x)/, "$1 * $2" )
						.replace( "x", sampleX )
						.replace( /(\d)(\()/, "$1 * $2" );
				var newCorrect = correct
						.replace( /(\d)(x)/, "$1 * $2" )
						.replace( "x", sampleX )
						.replace( /(\d)(\()/, "$1 * $2" )
						.replace( /-\s?-/, "");
				result = result &&  ( eval( newCorrect ) === eval( newGuess ) ) ;
			}
			return result;
		}
		verifier.examples = "An equation of a line, like 3(x+1)/2 or 2x + 1";
		return Khan.answerTypes.text( solutionarea, solution, fallback, verifier );

	}
	,


	number: function( solutionarea, solution, fallback, forms ) {
		var options = jQuery.extend({
			simplify: "required",
			ratio: false,
			maxError: Math.pow( 2, -42 ),
			forms: "literal, integer, proper, improper, mixed, decimal"
		}, jQuery( solution ).data());
		var acceptableForms = ( forms || options.forms ).split(/\s*,\s*/);

		var fractionTransformer = function( text ) {
			text = text

				// Replace unicode minus sign with hyphen
				.replace( /\u2212/, "-" )

				// Remove space after +, -
				.replace( /([+-])\s+/g, "$1" );

				// Extract numerator and denominator
			var match = text.match( /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/ );
			var parsedInt = parseInt( text, 10 );

			if ( match ) {
				var num = parseFloat( match[1] ),
					denom = parseFloat( match[2] );
				var simplified = denom > 0 &&
					( options.ratio || match[2] !== "1" ) &&
					KhanUtil.getGCD( num, denom ) === 1;
				return [ {
					value: num / denom,
					exact: simplified
				} ];
			} else if ( !isNaN( parsedInt ) ) {
				return [ {
					value: parsedInt,
					exact: true
				} ];
			}

			return [];
		};

		var forms = {
			literal: {
				transformer: function( text ) {
					// Prevent literal comparisons for decimal-looking-like strings
					return [{ value: ( /[^+-\u2212\d\.\s]/ ).test( text ) ? text : null }];
				}
			},

			integer: {
				transformer: function( text ) {
					return forms.decimal.transformer( text );
				},
				example: "an integer, like <code>6</code>"
			},

			proper: {
				transformer: function( text ) {
					return jQuery.map( fractionTransformer( text ), function( o ) {
						if ( Math.abs(o.value) < 1 ) {
							return [o];
						} else {
							return [];
						}
					} );
				},
				example: (function() {
					if ( options.simplify === "optional" ) {
						return "a <em>proper</em> fraction, like <code>1/2</code> or <code>6/10</code>"
					} else {
						return "a <em>simplified proper</em> fraction, like <code>3/5</code>"
					}
				})()
			},

			improper: {
				transformer: function( text ) {
					return jQuery.map( fractionTransformer( text ), function( o ) {
						if ( Math.abs(o.value) >= 1 ) {
							return [o];
						} else {
							return [];
						}
					} );
				},
				example: (function() {
					if ( options.simplify === "optional" ) {
						return "an <em>improper</em> fraction, like <code>10/7</code> or <code>14/8</code>"
					} else {
						return "a <em>simplified improper</em> fraction, like <code>7/4</code>"
					}
				})()
			},

			pi: {
				transformer: function( text ) {
					var match, possibilities = [];

					// Replace unicode minus sign with hyphen
					text = text.replace( /\u2212/, "-" );

					// - pi
					if ( match = text.match( /^([+-]?)\s*(?:pi?|\u03c0)$/i ) ) {
						possibilities = [ { value: parseFloat( match[1] + "1" ), exact: true } ];

					// 5 / 6 pi
					} else if ( match = text.match( /^([+-]?\d+\s*(?:\/\s*[+-]?\d+)?)\s*\*?\s*(?:pi?|\u03c0)$/i ) ) {
						possibilities = fractionTransformer( match[1] );

					// 5 pi / 6
					} else if ( match = text.match( /^([+-]?\d+)\s*\*?\s*(?:pi?|\u03c0)\s*(?:\/\s*([+-]?\d+))?$/i ) ) {
						possibilities = fractionTransformer( match[1] + match[2] );

					// - pi / 4
					} else if ( match = text.match( /^([+-]?)\s*\*?\s*(?:pi?|\u03c0)\s*(?:\/\s*([+-]?\d+))?$/i ) ) {
						possibilities = fractionTransformer( match[1] + "1/" + match[2] );

					// 0
					} else if ( text === "0") {
						possibilities = [ { value: 0, exact: true } ];

					// 0.5 pi (fallback)
					} else if ( match = text.match( /^(\S+)\s*\*?\s*(?:pi?|\u03c0)$/i ) ) {
						possibilities = forms.decimal.transformer( match[1] );
					}

					jQuery.each( possibilities, function( ix, possibility ) {
						possibility.value *= Math.PI;
					} );
					return possibilities;
				},
				example: "a multiple of pi, like <code>12\\ \\text{pi}</code> or <code>2/3\\ \\text{pi}</code>"
			},

			// simple log( c ) form
			log: {
				transformer: function( text ) {
					var match, possibilities = [];

					// Replace unicode minus sign with hyphen
					text = text.replace( /\u2212/, "-" );

 					if ( match = text.match( /^log\(\s*(\S+)\s*\)$/i ) ) {
						possibilities = forms.decimal.transformer( match[1] );
					} else if ( text === "0") {
						possibilities = [ { value: 0, exact: true } ];
					}
					return possibilities;
				},
				example: "an expression, like <code>\\log(100)</code>"
			},

			percent: {
				transformer: function( text ) {
					text = jQuery.trim( text );
					var hasPercentSign = false;

					if ( text.indexOf( "%" ) === ( text.length - 1 ) ) {
						text = jQuery.trim( text.substring( 0, text.length - 1) );
						hasPercentSign = true;
					}

					var transformed = forms.decimal.transformer( text );
					jQuery.each( transformed, function( ix, t ) {
						t.exact = hasPercentSign;
					});
					return transformed;
				},
				example: "a percent, like <code>12.34\\%</code>"
			},

			dollar: {
				transformer: function( text ) {
					text = jQuery.trim( text ).replace( '$', '' );

					return forms.decimal.transformer( text );
				},
				example: "a money amount, like <code>$2.75</code>"
			},

			mixed: {
				transformer: function( text ) {
					var match = text
						// Replace unicode minus sign with hyphen
						.replace( /\u2212/, "-" )

						// Remove space after +, -
						.replace( /([+-])\s+/g, "$1" )

						// Extract integer, numerator and denominator
						.match( /^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/ );

					if ( match ) {
						var sign  = parseFloat( match[1] + "1" ),
							integ = parseFloat( match[2] ),
							num   = parseFloat( match[3] ),
							denom = parseFloat( match[4] );
						var simplified = num < denom && KhanUtil.getGCD( num, denom ) === 1;

						return [ {
							value: sign * ( integ + num / denom ),
							exact: simplified
						} ];
					}

					return [];
				},
				example: "a mixed number, like <code>1\\ 3/4</code>"
			},

			decimal: {
				transformer: function( text ) {
					var normal = function( text ) {
						var match = text

							// Replace unicode minus sign with hyphen
							.replace( /\u2212/, "-" )

							// Remove commas
							.replace( /,\s*/g, "" )

							// Extract integer, numerator and denominator
							// This matches [+-]?\.; will f
							.match( /^([+-]?(?:\d+\.?|\d*\.\d+))$/ );

						if ( match ) {
							var x = parseFloat( match[1] );

							if ( options.inexact === undefined ) {
								var factor = Math.pow( 10, 10 );
								x = Math.round( x * factor ) / factor;
							}

							return x;
						}
					};

					var commas = function( text ) {
						text = text.replace( /([\.,])/g, function( _, c ) { return ( c === "." ? "," : "." ); } );
						return normal( text );
					};

					return [
						{ value: normal( text ), exact: true },
						{ value: commas( text ), exact: true }
					];
				},
				example: (function() {
					if ( options.inexact === undefined ) {
						return "an <em>exact</em> decimal, like <code>0.75</code>";
					} else {
						return "a decimal, like <code>0.75</code>";
					}
				})()
			}
		};

		var verifier = function( correct, guess ) {
			correct = jQuery.trim( correct );
			guess = jQuery.trim( guess );

			correctFloat = parseFloat( correct );
			var ret = false;

			jQuery.each( acceptableForms, function( i, form ) {
				var transformed = forms[ form ].transformer( jQuery.trim( guess ) );

				for ( var i = 0, l = transformed.length; i < l; i++ ) {
					var val = transformed[ i ].value;
					var exact = transformed[ i ].exact;

					if ( typeof val === "string" &&
							correct.toLowerCase() === val.toLowerCase() ) {
						ret = true;
						return false; // break;
					} if ( typeof val === "number" &&
							Math.abs( correctFloat - val ) < options.maxError ) {
						if ( exact || options.simplify === "optional" ) {
							ret = true;
						} else if ( form === "percent" ){
							ret = inexactMessages.missingPercentSign;
						} else {
							ret = inexactMessages.unsimplified;
						}

						return false; // break;
					}
				}
			} );

			return ret;
		};

		verifier.examples = [];
		jQuery.each( acceptableForms, function( i, form ) {
			if ( forms[ form ] != null && forms[ form ].example != null ) {
				verifier.examples.push( forms[ form ].example );
			}
		});
		
		var input;
		
		if ( typeof userExercise !== "undefined" && userExercise.tablet ) {
			input = jQuery("<input type='number'/>");
		}

		return Khan.answerTypes.text( solutionarea, solution, fallback, verifier, input );
	},

	regex: function( solutionarea, solution, fallback ) {
		var verifier = function( correct, guess ) {
			return jQuery.trim( guess ).match( correct ) != null;
		};

		return Khan.answerTypes.text( solutionarea, solution, fallback, verifier );
	},

	decimal: function( solutionarea, solution, fallback ) {
		return Khan.answerTypes.number( solutionarea, solution, fallback, "decimal" );
	},

	rational: function( solutionarea, solution, fallback ) {
		return Khan.answerTypes.number( solutionarea, solution, fallback, "integer, proper, improper, mixed" );
	},

	// A little bit of a misnomer as proper fractions are also accepted
	improper: function( solutionarea, solution, fallback ) {
		return Khan.answerTypes.number( solutionarea, solution, fallback, "integer, proper, improper" );
	},

	mixed: function( solutionarea, solution, fallback ) {
		return Khan.answerTypes.number( solutionarea, solution, fallback, "integer, proper, mixed" );
	},

	radical: function( solutionarea, solution ) {
		var options = jQuery.extend({
			simplify: "required"
		}, jQuery( solution ).data());
		var ansSquared = parseFloat( jQuery( solution ).text() );
		var ans = KhanUtil.splitRadical( ansSquared );

		var inte = jQuery( "<span>" ), inteGuess, rad = jQuery( "<span>" ), radGuess;

		var inteValid = Khan.answerTypes.text( inte, null, "1", function( correct, guess ) { inteGuess = guess; } );
		var radValid = Khan.answerTypes.text( rad, null, "1", function( correct, guess ) { radGuess = guess; } );

		solutionarea.addClass( "radical" )
			.append( inte )
			.append( '<span class="surd">&radic;</span>')
			.append( rad.addClass( "overline" ) );

		var ret = function() {
			// Load entered values into inteGuess, radGuess
			inteValid();
			radValid();

			inteGuess = parseFloat( inteGuess );
			radGuess = parseFloat( radGuess );

			ret.guess = [ inteGuess, radGuess ];

			var simplified = inteGuess === ans[0] && radGuess == ans[1];
			var correct = Math.abs( inteGuess ) * inteGuess * radGuess === ansSquared;

			if ( correct ) {
				if ( simplified || options.simplify === "optional" ) {
					return true;
				} else {
					return inexactMessages.unsimplified;
				}
			} else {
				return false;
			}
		};
		if ( options.simplify === "required" ) {
			ret.examples = [ "a simplified radical, like <code>\\sqrt{2}</code> or <code>3\\sqrt{5}</code>" ];
		} else {
			ret.examples = [ "a radical, like <code>\\sqrt{8}</code> or <code>2\\sqrt{2}</code>" ];
		}
		ret.solution = ans;
		ret.showGuess = function( guess ) {
			inteValid.showGuess( guess ? guess[0] : '' );
			radValid.showGuess( guess ? guess[1] : '' );
		};
		return ret;
	},

	multiple: function( solutionarea, solution ) {
		var solutionarea = jQuery( solutionarea );
		// here be dragons
		solutionarea.append( jQuery( solution ).clone().contents().tmpl() );

		var solutionArray = [];

		solutionarea.find( ".sol" ).each(function() {
			var type = jQuery( this ).data( "type" );
			type = type != null ? type : "number";

			var sol = jQuery( this ).clone(),
				solarea = jQuery( this ).empty();

			var fallback = sol.data( "fallback" ),
				validator = Khan.answerTypes[type]( solarea, sol, fallback );

			jQuery( this ).data( "validator", validator );
			solutionArray.unshift( validator.solution );
		});

		var ret = function() {
			var valid = true,
				guess = [];

			solutionarea.find( ".sol" ).each(function() {
				var validator = jQuery( this ).data( "validator", validator );

				if ( validator != null ) {
					// Don't short-circuit so we can record all guesses
					valid = validator() && valid;

					guess.push( validator.guess );
				}
			});

			ret.guess = guess;

			return valid;
		};

		ret.showGuess = function( guess ) {
			guess = jQuery.extend( true, [], guess );

			solutionarea.find( ".sol" ).each(function() {
				var validator = jQuery( this ).data( "validator", validator );

				if ( validator != null ) {
					// Shift regardless of whether we can show the guess
					var next = guess.shift();

					if ( typeof validator.showGuess === "function" ) {
						validator.showGuess( next );
					}
				}
			});
		};

		ret.examples = solutionarea.find( ".example" ).remove()
			.map(function(i, el) {
				return jQuery( el ).html();
			});
		ret.solution = solutionArray;

		return ret;
	},

	radio: function( solutionarea, solution ) {
		var extractRawCode = function( solution ) {
			return jQuery( solution ).find('.value').clone()
				.find( ".MathJax" ).remove().end()
				.find( "code" ).removeAttr( "id" ).end()
				.html();
		};
		// Without this we get numbers twice and things sometimes
		var solutionText = extractRawCode( solution );

		var list = jQuery("<ul></ul>");
		jQuery( solutionarea ).append(list);

		// Get all of the wrong choices
		var choices = jQuery( solution ).siblings( ".choices" );

		// Set number of choices equal to all wrong plus one correct
		var numChoices = choices.children().length + 1;
		// Or set number as specified
		if ( choices.data("show") ) {
			numChoices = parseFloat( choices.data("show") );
		}

		// Optionally include none of the above as a choice
		var showNone = choices.data("none");
		if ( showNone ) {
			var noneIsCorrect = KhanUtil.rand(numChoices) === 0;
			numChoices -= 1;
		}

		// If a category exercise, the correct answer is already included in .choices
		// and choices are always presented in the same order
		var isCategory = choices.data("category");
		var possibleChoices = choices.children().get();
		if ( isCategory ) {
			numChoices -= 1;
		} else {
			possibleChoices = KhanUtil.shuffle( possibleChoices );
		}

		// Add the correct answer
		if( !noneIsCorrect && !isCategory) {
			jQuery( solution ).data( "correct", true );
		}

		// Insert correct answer as first of possibleChoices
		if ( !isCategory ) {
			possibleChoices.splice( 0, 0, solution );
		}

		var dupes = {};
		var shownChoices = [];
		var solutionTextSquish = solution.text().replace(/\s+/g, "");
		for ( var i = 0; i < possibleChoices.length && shownChoices.length < numChoices; i++ ) {
			var choice = jQuery( possibleChoices[i] );
			choice.runModules();
			var choiceTextSquish = choice.text().replace(/\s+/g, "");

			if ( isCategory && solutionTextSquish === choiceTextSquish ) {
				choice.data( "correct", true );
			}

			if ( !dupes[ choiceTextSquish ] ) {
				dupes[ choiceTextSquish ] = true;

				// i == 0 is the solution except in category mode; skip it when none is correct
				if ( !( noneIsCorrect && i == 0 ) || isCategory ) {
					shownChoices.push( choice );
				}
			}
		}

		if( shownChoices.length < numChoices ) {
			return false;
		}

		if ( !isCategory ) {
			shownChoices = KhanUtil.shuffle( shownChoices );
		}

		if( showNone ) {
			var none = jQuery( "<span>None of the above.</span>" );

			if( noneIsCorrect ) {
				none.data( "correct", true );
				solutionText = none.text();
				list.data( "real-answer",
						jQuery( solution ).runModules()
							.contents()
							.wrapAll( '<span class="value""></span>' )
							.parent() );
			}

			shownChoices.push( none );
		}

		jQuery.each(shownChoices, function( i, choice ) {
			var correct = choice.data( "correct" );
			choice.contents().wrapAll( '<li><label><span class="value"></span></label></li>' )
				.parent().before( '<input type="radio" name="solution" value="' + (correct ? 1 : 0) + '">' )
				.parent().parent()
				.appendTo(list);
		});

		var ret = function() {
			var choice = list.find("input:checked");

			if ( noneIsCorrect && choice.val() === "1") {
				choice.next()
					.fadeOut( "fast", function() {
						jQuery( this ).replaceWith( list.data( "real-answer" ) )
							.fadeIn( "fast" );
					});
			}

			ret.guess = jQuery.trim( extractRawCode(choice.closest("li")) );

			return choice.val() === "1";
		};
		ret.solution = jQuery.trim( solutionText );
		ret.showGuess = function( guess ) {
			list.find( 'input:checked' ).prop( 'checked', false);

			var li = list.children().filter( function() {
				return jQuery.trim( extractRawCode(this) ) === guess;
			} );
			li.find( "input[name=solution]" ).prop( "checked", true );
		};
		return ret;
	},

	list: function( solutionarea, solution ) {
		var input = jQuery("<select></select>");
		jQuery( solutionarea ).append( input );

		var choices = jQuery.tmpl.getVAR( jQuery( solution ).data("choices") );

		jQuery.each( choices, function(index, value) {
			input.append('<option value="' + value + '">'
				+ value + '</option>');
		});

		var correct = jQuery( solution ).text();

		var verifier = function( correct, guess ) {
			correct = jQuery.trim( correct );
			guess = jQuery.trim( guess );
			return correct === guess;
		};

		var ret = function() {
			ret.guess = input.val();

			return verifier( correct, ret.guess );
		};

		ret.solution = jQuery.trim( correct );

		ret.showGuess = function( guess ) {
			input.val( guess );
		};

		return ret;
	},

	primeFactorization: function( solutionarea, solution, fallback ) {
		var verifier = function( correct, guess ) {
			guess = guess.split(" ").join("").toLowerCase();
			guess = KhanUtil.sortNumbers( guess.split( /x|\*|\u00d7/ ) ).join( "x" );
			return guess === correct;
		};
		verifier.examples = [
			"a product of prime factors, like <code>2 \\times 3</code>",
			"a single prime number, like <code>5</code>"
		];

		return Khan.answerTypes.text( solutionarea, solution, fallback, verifier );
	}
} );

} )();
