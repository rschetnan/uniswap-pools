google.charts.load('current', {'packages':['corechart']});
google.charts.load('current', {'packages':['table']});
google.charts.setOnLoadCallback(renderPairs);

var tableData;
var table;

async function getPairs()
{
  try {
      let res = await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query: "{ pairs(first: 800, orderBy: reserveUSD, orderDirection: desc ) { id reserveUSD volumeUSD untrackedVolumeUSD txCount token0 { symbol } token1 { symbol } } }"})
      })
      return await res.json();
  } catch (error) {
      console.log(error);
  }
}

async function renderPairs()
{
  let pairs = await getPairs();
  let pairDataArray = [['Pair', 'Liquidity', 'Cumulative<br>Tracked Volume', 'Cumulative<br>Untracked Volume', 'Cumulative<br>Tracked Fees', 'Cumulative<br>Untracked Fees', 'Cumulative Tracked<br>Fees to Liquidity', 'Cumulative Untracked<br>Fees to Liquidity','Transaction<br>Count', 'Contract']];
  let pairSelectControl = document.getElementById("pairSelectControl");

  for(var i = 0; i < pairs["data"]["pairs"].length; i++)
  {
    // Populate the search list
    let pairOption = document.createElement("option");
    let pairName = `${pairs["data"]["pairs"][i]["token0"]["symbol"]} - ${pairs["data"]["pairs"][i]["token1"]["symbol"]}`;
    let pairID = pairs["data"]["pairs"][i]["id"];
    pairOption.text = pairName;
    pairOption.value = pairID;
    pairSelectControl.appendChild(pairOption);
    // Populate the data array
    let pairLiquidity = Math.round(pairs["data"]["pairs"][i]["reserveUSD"]);
    let pairVolume = Math.round(pairs["data"]["pairs"][i]["volumeUSD"]);
    let pairUntrackedVolume = Math.round(pairs["data"]["pairs"][i]["untrackedVolumeUSD"]);
    let pairTransactionCount = Number.parseInt(pairs["data"]["pairs"][i]["txCount"]);
    let trackedFees = Math.round(pairVolume * 0.003);
    let untrackedFees = Math.round(pairUntrackedVolume * 0.003);
    let trackedFeesToLiquidity = trackedFees / pairLiquidity;
    let untrackedFeesToLiquidity = untrackedFees / pairLiquidity;
    let pairData = [ pairName, pairLiquidity, pairVolume, pairUntrackedVolume, trackedFees, untrackedFees, trackedFeesToLiquidity, untrackedFeesToLiquidity, pairTransactionCount, pairID ];
    pairDataArray.push(pairData);
  }
  //Set up table and controls
  tableData = google.visualization.arrayToDataTable(pairDataArray);
  table = new google.visualization.Table(document.getElementById('table'));
  let tableOptions = { 'showRowNumber':true, 'allowHtml':true };
  table.draw(tableData, tableOptions);
  google.visualization.events.addListener(table, 'select', renderPairPerformanceData);
  pairSelectControl.selectedIndex = 0;
  document.getElementById("loader").style.display = "none";
  document.getElementById("showDataButton").disabled = false;
  document.getElementById("pairSelectControl").disabled = false;
}

async function getPairPerformanceData() {
  let selectedPairValue = tableData.getFormattedValue(table.getSelection()[0].row, 9);
  let currentMillis = Date.now();
  let millisInDay = 24 * 60 * 60 * 1000;
  let millisDifference = millisInDay * 61;
  let startMillis = currentMillis - millisDifference;
  let startSeconds = Math.round(startMillis / 1000)
  let queryContent = `{ pairDayDatas( first: 60, orderBy: date, orderDirection: asc, where: { pairAddress: \"${selectedPairValue}\", date_gt: ${startSeconds} } ) { date dailyVolumeUSD reserveUSD } }`
  let queryObject = { query: queryContent };
  try {
      let res = await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(queryObject)
      })
      return await res.json();
  } catch (error) {
      console.log(error);
  }
}

async function renderPairPerformanceData()
{
  document.getElementById("showDataButton").disabled = true;
  document.getElementById("pairSelectControl").disabled = true;
  document.getElementById("loader").style.display = "block";
  let performanceData = await getPairPerformanceData();
  let pairDataArray = [['Date', 'Volume', 'Liquidity', 'Fees']];
  let performanceDataLength = performanceData["data"]["pairDayDatas"].length;
  let liquiditySum = 0;
  let volumeSum = 0;
  let feeSum = 0;
  for (var i = 0; i < performanceDataLength; i++)
  {
    let dateSeconds = performanceData["data"]["pairDayDatas"][i]["date"];
    let dateMillis = dateSeconds * 1000;
    let pairDate = new Date();
    pairDate.setTime(dateMillis);
    let pairMonth = pairDate.getUTCMonth() + 1;
    let formattedPairDate = `${pairMonth}-${pairDate.getUTCDate()}-${pairDate.getUTCFullYear()}`;
    let roundedVolume = Math.round(performanceData["data"]["pairDayDatas"][i]["dailyVolumeUSD"]);
    volumeSum += roundedVolume;
    let fees = roundedVolume * 0.003;
    let roundedFees = Math.round(fees);
    feeSum += roundedFees;
    let roundedLiquidity = Math.round(performanceData["data"]["pairDayDatas"][i]["reserveUSD"]);
    liquiditySum += roundedLiquidity
    let dailyPerformanceData = [ formattedPairDate, roundedVolume, roundedLiquidity, roundedFees ];
    pairDataArray.push(dailyPerformanceData);
  }

  let averageVolume = 0;
  let averageFees = 0;
  let averageLiquidity = 0;
  let feesToLiquidity = 0;
  if (liquiditySum > 0) {
    feesToLiquidity = feeSum / liquiditySum;
  }

  let averageDailyFees = feesToLiquidity * 1000;
  //Avoid division by zero
  if (performanceDataLength > 0)
  {
    averageVolume = volumeSum / performanceDataLength;
    averageFees = feeSum / performanceDataLength;
    averageLiquidity = liquiditySum / performanceDataLength;
  }

  let statsDiv = document.getElementById("stats");
  let childElement = statsDiv.firstElementChild;
  //Clear the div contents
  while (childElement) {
    childElement.remove();
    childElement = statsDiv.firstElementChild;
  }
  //Populate the stats div
  let headingElement =  document.createElement("h4");
  let headingContent = `${performanceDataLength}-Day Averages in USD*`;
  headingElement.appendChild(document.createTextNode(headingContent));
  statsDiv.appendChild(headingElement);
  let formattedNumber = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageLiquidity);
  let textNodeContent = `Average liquidity: ${formattedNumber}`;
  let textNode = document.createTextNode(textNodeContent);
  let paragraphElement = document.createElement("p");
  paragraphElement.appendChild(textNode);
  statsDiv.appendChild(paragraphElement);
  formattedNumber = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageVolume);
  textNodeContent = `Average volume*: ${formattedNumber}`;
  textNode = document.createTextNode(textNodeContent);
  paragraphElement = document.createElement("p");
  paragraphElement.appendChild(textNode);
  statsDiv.appendChild(paragraphElement);
  formattedNumber = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageFees);
  textNodeContent = `Average fees*: ${formattedNumber}`;
  textNode = document.createTextNode(textNodeContent);
  paragraphElement = document.createElement("p");
  paragraphElement.appendChild(textNode);
  statsDiv.appendChild(paragraphElement);
  textNodeContent = `Fees to liquidity ratio: ${feesToLiquidity}`;
  textNode = document.createTextNode(textNodeContent);
  paragraphElement = document.createElement("p");
  paragraphElement.appendChild(textNode);
  statsDiv.appendChild(paragraphElement);
  formattedNumber = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageDailyFees);
  textNodeContent = `Average daily fees earned on $1,000 liquidity (ignoring accrual and impermanent loss): ${formattedNumber}`;
  textNode = document.createTextNode(textNodeContent);
  paragraphElement = document.createElement("p");
  paragraphElement.appendChild(textNode);
  statsDiv.appendChild(paragraphElement);
  paragraphElement = document.createElement("p");
  let emphasisElement = document.createElement("em");
  textNode = document.createTextNode("*Note: Some volume and fee data may not be available.");
  emphasisElement.appendChild(textNode);
  paragraphElement.appendChild(emphasisElement);
  statsDiv.appendChild(paragraphElement);
  //Set up the chart and controls
  let chartData = google.visualization.arrayToDataTable(pairDataArray);
  let selectedPairName = tableData.getFormattedValue(table.getSelection()[0].row, 0);

  let titleText = `${selectedPairName} Liquidity Pool Performance*`;
  let options = {
        title: titleText,
        hAxis: {title: 'Date',  titleTextStyle: {color: '#333'}},
        vAxis: {minValue: 0}
      };

  document.getElementById("loader").style.display = "none";
  document.getElementById("chart").style.display = "block";
  document.getElementById("showDataButton").disabled = false;
  document.getElementById("pairSelectControl").disabled = false;
  let chart = new google.visualization.AreaChart(document.getElementById('chart'));
  chart.draw(chartData, options);
}

function searchHandler()
{
  let selectedPairIndex = document.getElementById("pairSelectControl").selectedIndex;
  //Set the table row
  let selectionArray = [];
  let selection = { row: selectedPairIndex, column: null };
  selectionArray.push(selection);
  table.setSelection(selectionArray);
  renderPairPerformanceData();
}

$(document).ready(function() {
    $('.selectClass').select2();
    document.getElementById("showDataButton").addEventListener("click", searchHandler);
});
