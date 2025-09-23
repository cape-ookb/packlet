# Messy Content Test Document


## Introduction Section

This is a paragraph with extra   trailing spaces   and multiple    internal   spaces.



This paragraph has way too many blank lines above it.




## Code Examples

Here's some indented code that needs dedenting:

        function badlyIndented() {
            console.log("This has excessive indentation");
                if (true) {
                    return "nested badly";
                }
        }



But fenced code blocks should be preserved exactly:

```javascript
function wellFormatted() {
    // This indentation should be kept exactly as is
    console.log("Perfect formatting");
        if (condition) {
            // Even this weird indentation should stay
        return value;
        }
}
```




## Lists with Issues

- List item with trailing spaces
-   Another item with irregular spacing


  - Nested item with bad indentation
    -   More nesting issues



## Mixed Content

This paragraph has    multiple   spaces    and   trailing   whitespace.


```python
def preserve_this():
    # This function should keep its exact formatting
    return "unchanged"
```

    This is indented text that should be dedented
        This has even more indentation
            And this has the most

End of messy document.


