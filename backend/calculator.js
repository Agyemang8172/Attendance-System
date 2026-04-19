    const addition = (num1,num2)  => {
        
        return num1 + num2
    }

    const subtraction  = (num1 , num2) => {
        return num1 - num2
    }

    const multiply =  (num1,num2)  => {
    return num1 *  num2
    }

    const divide = (num1,num2) => {
       if ( num2 === 0)
       {
        return "Error, Cannot divide by 0"
}
  return num1 / num2 
    }

    module.exports = {
        addition,
        subtraction,
        divide,
        multiply
    }