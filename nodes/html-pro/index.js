module.exports = function(RED) {
    const parser = require('node-html-parser');

    const handleAs = {
        Text: 0,
        Html: 1,
        Value: 2,
        Attribute: 3,
    };

    const extractValue = (selector) => {
        switch (selector.rawTagName) {
            case 'textarea':
                return selector.text;
            case 'select':
                if (!selector.hasAttribute('multiple')) {
                    return selector.querySelector('option[selected]')?.getAttribute('value');
                }

                return selector.querySelectorAll('option[selected]').reduce((all, option) => [...all, option?.getAttribute('value')],[]);
            case 'input':
            case 'option': {
                return selector.getAttribute('value');
            }
        }
    };

    const handleReturnValue = (selector, props) => {
        const returnValue = +props.returnValue;
        if (returnValue === handleAs.Text) {
            return selector?.text;
        }

        if (returnValue === handleAs.Html) {
            return selector?.toString();
        }

        if (returnValue === handleAs.Value) {
            return extractValue(selector);
        }

        if (returnValue === handleAs.Attribute) {
            if (props.attribute) {
                return selector?.getAttribute(props.attribute);
            }
            return selector?.attrs;
        }

        return selector?.toString();
    };

    function ParserNode(props) {
        RED.nodes.createNode(this, props);

        this.property = props.property || 'payload';
        this.outproperty = props.outproperty || this.property || 'payload';
        this.selectors = props.selectors;
        this.dotrim = props.dotrim;

        const node = this;

        node.on('input', function(msg, send, done) {
            const htmlContent = RED.util.getMessageProperty(msg, node.property);
            if (htmlContent === undefined) {
                done(`Cant find property name ${node.property} in msg object`);

                return;
            }

            try {
                const root = parser.parse(htmlContent);

                const response = node.selectors.reduce((all, selector) => {
                    if (selector.returnArray) {
                        all[selector.key] = root.querySelectorAll(selector.path).map((curr) => handleReturnValue(curr, selector));
                    } else {
                        all[selector.key] = handleReturnValue(root.querySelector(selector.path), selector);
                    }

                    return all;
                }, {});

                RED.util.setMessageProperty(msg, node.outproperty, response);
                send(msg);

                done();
            } catch (error) {
                done(error.message);
            }
        });
    }

    RED.nodes.registerType('html-pro', ParserNode);
}