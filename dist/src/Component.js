"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("./Logger");
const USED = Symbol('CHILD_ALREADY_USED');
class Component {
    constructor(props, children) {
        this.props = props;
        this.children = children;
        this.logger = new Logger_1.Logger(props.name + '.' + props.type, props.color);
        this.bus = props.bus;
    }
    sprout(name, alternative) {
        const childProps = this.props[name] || {};
        const props = Object.assign({}, this.props, { type: name }, childProps, { bus: this.bus });
        if (this.children[name] === USED)
            throw new Error('Child ' + name + ' already used');
        if (this.children[name] != null) {
            const module = this.children[name];
            if (typeof module != 'function')
                throw new Error(this.props.name + '.' + name + ': must be a constructor');
            this.children[name] = USED;
            return new module(props, this.children);
        }
        else if (alternative != null) {
            this.children[name] = USED;
            return new alternative[name](props, this.children);
        }
        throw new Error('Unable to sprout ' + name);
    }
}
exports.Component = Component;
//# sourceMappingURL=Component.js.map