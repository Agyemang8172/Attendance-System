import React from 'react'

const InventoryTable = ({ inventory}) => {
  return (
     <table border="1" >
        <thead>
            <tr>
               <th>Name</th>
                <th>
                    Category
                </th>
                <th>
                    Quantity
                </th>
                <th>
                    Price
                </th>
            </tr>
        </thead>
        <tbody>
           {inventory.map((item)=> (
            <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.quantity}</td>
                <td>{item.price}</td>
            </tr>
           ))}
        </tbody>

     </table>
  )
}

export default InventoryTable
