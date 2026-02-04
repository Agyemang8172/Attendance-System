import React from 'react'


const Header = ({ title }) => {

    const today = new Date().toLocaleDateString('en-US',{
      weekday : 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'

    })
  return (
    <div>
       {today}
      {title}
    </div>
  )
}

export default Header
