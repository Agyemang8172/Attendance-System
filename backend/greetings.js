const greetUser = (name) => {
  return(`Hello ${name}, welcome to the attendance system` )

}

const getTimeGreeting = () => {
   const hour = new Date().getHours();

   if (hour < 12)  
    return 'Goodmorning'
   if ( hour < 18)
     return 'GoodAfternoon'
     return 'Good evening'
}

module.exports = {
  greetUser,
  getTimeGreeting
}








