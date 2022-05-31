import * as React from 'react';
import { Component } from 'react';

export interface TestProps {
    
}
 
export interface TestState {
    
}
 
class Test extends React.Component<TestProps, TestState> {
    state = {
        count: 2
    };
    render() { 
        return (
            <React.Fragment>
                <h1>{this.state.count}</h1>
                <button>Krill my slef</button>
            </React.Fragment>
        );
    }
}
 
export default Test;