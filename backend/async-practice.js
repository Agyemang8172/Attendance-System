const fetchUserFromDatabase = (userId)  => {
   return new Promise((resolve) => {
    console.log(`Fetching user ${userId} from database...`)


 setTimeout(()=> {
    resolve({
        id: userId,
        name:'Godfred',
        role: 'Staff',
        department: 'sales'
    });

 },2000);


   });
}


const getUserInfoCorrect = async () => {
    console.log('Starting to fetch User')
    const user = await fetchUserFromDatabase(1)
    console.log(user)
}   

setTimeout(()=> {
    getUserInfoCorrect()
},3000)



    

const getAttendanceFromDb = (employeeId)  => {
    return new Promise((resolve)=> {
        setTimeout(()=> {
         resolve([
        { date: "2024-01-15", hours: 8, status: "present" },
        { date: "2024-01-16", hours: 7.5, status: "late" },
        { date: "2024-01-17", hours: 8, status: "present" }
      ]);
        },1500)

    })
}


const getEmployeeAttendance = async (employeeId)  => {
  console.log(`Fetching attendance from ${employeeId}`)
 const attendance = await getAttendanceFromDb(employeeId);

 const totalHours = attendance.reduce((sum, record)=> sum + record.hours,0)
 console.log(attendance)
 console.log(totalHours)
 return {attendance,totalHours}
}


// Call it
getEmployeeAttendance("EMP001");


const fetchUserWithError = (userId)  => {
    return new Promise((resolve,reject)=> {
        setTimeout(()=> {
            if (userId === 999)  {
               reject('Error: User not found')
            } else {
                resolve({ id :userId,name:'Godfred' })
            }
        },1000)
    })
}
const getUserWithErrorHandling = async (userId) => {
    try {
        console.log(`Trying to fetch user ${userId}...`)
        const user = await fetchUserWithError(userId)
        console.log('Successs', user)

    } catch(error)  {
        console.log(error)
    }
}



getUserWithErrorHandling(1)
getUserWithErrorHandling(999)


const fetchMultipleUsers = async ()  => {
  console.log('Fetching User 1...');
  const user1 = await fetchUserFromDatabase(1)
  console.log('Got User 1:', user1.name)

  console.log('Fetching User 2...');
  const user2 = await fetchUserFromDatabase(2)
  console.log('Got User 2:', user2.name)

  console.log('Fetching User 3...');
  const user3 = await fetchUserFromDatabase(3)
  console.log('Got User 3:', user3.name)

  console.log('Fetching User 4...');
  const user4 = await fetchUserFromDatabase(4)
  console.log('Got User 4:', user4.name)

}

fetchMultipleUsers()
