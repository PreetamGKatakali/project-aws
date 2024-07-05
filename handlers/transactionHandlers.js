const Transaction = require('../models/transactionModel');


const getDateRangeForMonth = (monthName) => {
    const year = new Date().getFullYear();
    const month = new Date(`${monthName} 1, ${year}`).getMonth(); // Convert month name to month number
    const startDate = new Date(Date.UTC(year, month, 1)); // UTC start date
    const endDate = new Date(Date.UTC(year, month + 1, 1)); // UTC start date of the next month
    console.log(`Start Date: ${startDate.toISOString()}, End Date: ${endDate.toISOString()}`); // Check the start and end dates
    return { startDate, endDate };
  };

// Helper function to format month for regex pattern
const formatMonthForRegex = async(month) => {
  const monthIndex = new Date(Date.parse(month + " 1, 2000")).getMonth();
  const monthString = (monthIndex + 1 < 10 ? '0' + (monthIndex + 1) : (monthIndex + 1)).toString();

  const regex = new RegExp(`-${monthString}-`, 'g');

  return regex;
};

// Fetching transactions with filtering, searching, and pagination
const fetchTransactions = async ({ month, page, perPage, search }) => {
  const query = {};
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { price: parseFloat(search) || null }
    ];
  }
  if (month) {
    const monthRegex = await formatMonthForRegex(month);
    query.dateOfSale = { $regex: monthRegex };
  }

  const transactions = await Transaction.find(query)
    .skip((page - 1) * perPage)
    .limit(perPage)
    .exec();

  const total = await Transaction.countDocuments(query);
  return {
    transactions,
    total,
    pages: Math.ceil(total / perPage),
    currentPage: page
  };
};

// Fetching bar chart data
// const fetchBarChartData = async (month) => {
//   const boundaries = [0, 101, 201, 301, 401, 501, 601, 701, 801, 901];
//   const monthRegex = await formatMonthForRegex(month);
//   const barChartData = await Transaction.aggregate([
//     {
//       $match: {
//         dateOfSale: { $regex: monthRegex }
//       }
//     },
//     {
//       $bucket: {
//         groupBy: "$price",
//         boundaries: boundaries,
//         default: "901-above",
//         output: {
//           count: { $sum: 1 }
//         }
//       }
//     }
//   ]);

//   return barChartData.map(item => ({
//     range: item._id === "901-above" ? "901 and above" : `${item._id} - ${item._id + 99}`,
//     count: item.count
//   }));
// };
// Fetching bar chart data
const fetchBarChartData = async (monthName) => {
    const { startDate, endDate } = getDateRangeForMonth(monthName);
    const boundaries = [0, 101, 201, 301, 401, 501, 601, 701, 801, 901];
  
    const barChartData = await Transaction.aggregate([
      {
        $match: {
          dateOfSale: {
            $gte: startDate,
            $lt: endDate
          }
        }
      },
      {
        $bucket: {
          groupBy: "$price",
          boundaries: boundaries,
          default: "901-above",
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);
  
    if (barChartData.length === 0) {
      console.log("No data found for the specified month.");
    } else {
      console.log("Bar chart data:", barChartData);
    }
  
    return barChartData.map(item => ({
      range: item._id === "901-above" ? "901 and above" : `${item._id} - ${item._id + 99}`,
      count: item.count
    }));
  };

// Fetching pie chart data
const fetchPieChartData = async (month) => {
  const monthRegex = await formatMonthForRegex(month);
  const pieChartData = await Transaction.aggregate([
    {
      $match: {
        dateOfSale: { $regex: monthRegex }
      }
    },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 }
      }
    }
  ]);

  return pieChartData.map(cat => ({
    category: cat._id,
    count: cat.count
  }));
};

// Fetch combined data from all APIs
const fetchCombinedData = async ({ month, page, perPage, search }) => {
  const [transactionsData, barChartData, pieChartData] = await Promise.all([
    fetchTransactions({ month, page, perPage, search }),
    fetchBarChartData(month),
    fetchPieChartData(month)
  ]);

  return {
    transactionsData,
    barChartData,
    pieChartData
  };
};

module.exports = {
  fetchTransactions,
  fetchBarChartData,
  fetchPieChartData,
  fetchCombinedData
};
