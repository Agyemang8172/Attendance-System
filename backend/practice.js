const attendanceRecords = [
  { name: "John", date: "2024-01-15", hours: 8 },
  { name: "Mary", date: "2024-01-15", hours: 7.5 },
  { name: "John", date: "2024-01-16", hours: 8.5 },
  { name: "Mary", date: "2024-01-16", hours: 8 },
  { name: "John", date: "2024-01-17", hours: 9 }
];

const johnsRecord = attendanceRecords.filter(record => record.name === "John")
console.log("John's attendance:", johnsRecord)

const allHours = attendanceRecords.map(record => record.hours)
console.log('All hours worked:', allHours)

const totalHours = attendanceRecords.reduce((sum, record)=> sum + record.hours,0)
console.log('Total Hours:', totalHours)

const johnsTotalHours = attendanceRecords
   .filter(record =>  record.name === 'John')
   .reduce((sum,record)=> sum + record.hours,0)
   
   console.log("John's total hours :", johnsTotalHours)



   const marysRecord = attendanceRecords.filter(record=> record.name === 'Mary')
   console.log('Marys Record:', marysRecord)

   const allDates = attendanceRecords.map(record => record.date )
   console.log(' All Dates:', allDates)

   const marysTotalHours  = attendanceRecords
   .filter(record=> record.name === "Mary")
   .reduce((sum,record)=> sum +record.hours,0 )

   console.log("Mary's total Hours:",marysTotalHours)

   const numberOfRecords = attendanceRecords.length
   console.log('Number of Records:', numberOfRecords)