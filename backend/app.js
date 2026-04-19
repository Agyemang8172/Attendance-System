const calculator = require('./calculator')

console.log('5+3=', calculator.addition(5, 3))  

console.log('10-2=', calculator.subtraction(10,2))  
console.log('20 * 2=', calculator.multiply(20,2))  
console.log('50 / 2=', calculator.divide(50, 2))  
console.log('10 / 0=', calculator.divide(10, 0))  