import React from 'react'

const InventoryTable = ({ inventory,increaseQuantity,decreaseQuantity}) => {
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
                    Min Stock
                </th>
                <th>
                    Price
                </th>
                <th>
                    Actions
                </th>
            </tr>
        </thead>
        <tbody>
           {inventory.map((item)=> (
            <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td 
                    style= {{
                         color : item.quantity < item.minStock ? 'red' : 'black',
                         fontWeight : item.quantity < item.minStock ? 'bold' : 'normal'                        
                        }}
                >{item.quantity}</td>
                <td>{item.minStock}</td>
                <td>{item.price}</td>
                <td>
                    <button onClick={()=>
                increaseQuantity(item.id)}
                  style = {{ cursor : 'pointer'}}
                >
                         +
                  </button>
                  <button
                    onClick={()=>
                     decreaseQuantity(item.id)
                    }
                    disabled = {item.quantity === 0}
                    style={{
                         cursor: item.quantity === 0 ? 'not-allowed' : 'pointer',
                         opacity : item.quantity === 0 ? 0.5 : 1

                    }}
                  >
                       -
                  </button>
                </td>
            </tr>
           ))}
        </tbody>

     </table>
  )
}

export default InventoryTable
