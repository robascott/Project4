angular
  .module('hotkeys')
  .controller('GamesController', GamesController);

GamesController.$inject = ['User', 'Race', 'TokenService', '$state', 'CurrentUser', '$sce', '$interval', '$timeout', 'socket', '$scope', '$window', '$route'];
function GamesController(User, Race, TokenService, $state, CurrentUser, $sce, $interval, $timeout, socket, $scope, $window, $route){

  var self = this;

  var paragraphText;
  var paragraphWords;
  var paragraphHtmlArray = "";
  var wordIndex = 0;
  var timerInterval;

  self.isLoggedIn           = isLoggedIn;
  self.getUserId            = getUserId;
  self.getText              = getText;
  self.updateUsername       = updateUsername;
  self.updateStats          = updateStats;
  self.updateState          = updateState;
  self.renderParagraph      = renderParagraph;
  self.convertToOrdinal     = convertToOrdinal;
  self.playersLeftInRace    = playersLeftInRace;
  self.checkIfRoomIsEmpty   = checkIfRoomIsEmpty;
  self.saveRace             = saveRace;
  self.reachedFinish        = reachedFinish;
  self.didNotFinish         = didNotFinish;
  self.startTimer           = startTimer;
  self.newGame              = newGame;
  self.startGame            = startGame;
  self.selectText           = selectText;


  // Get room name from state params
  self.room = $state.params.room_id;

  self.roomUrl = window.location.protocol + "//" + window.location.host + "/play/" + self.room;

  self.inputText = "";  // Text in input box
  self.typedSoFar = ""; // Portion of paragraph text typed so far

  self.tempName = "";  // Temporary username
  self.timerText = ""; // Countdown timer string
  self.typeboxPlaceholder = "Type here when the race starts";

  // Set name
  if (isLoggedIn()) {
    self.name = CurrentUser.getUser().local.username;
  } else {
    self.name = "Player " + (Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000);
  }

  // Player data
  self.myData = {percentage: "", wpm: "", position: "New player"};
  self.playerData = {};  // e.g. {234235235: {name: 'James', perctentage: 24, position: 1}, 23412353: {name: 'Mark', percentage: 18, position: 2}}
  self.playerPositions = {} // e.g. {234235235: 1, 3452345234: 2}
  
  
  // Game state info
  self.currentState; // countdown|racing|finished
  self.noOfPlayersInRound;
  self.inputDisabled = true;
  self.gameRunning = false;
  self.gameInProgress = false;
  self.waitingToJoin = true;
  self.incorrect = false;
  var nextWord = "";

  // Switch to 
  socket.emit('switchRoom', {room: self.room});

  // Check if a race is already in progress
  var responsesArray = [];
  socket.on('sendingGameStateToClient', function(data) {
    responsesArray.push(data.gameRunning);
  });

  // Wait 1 second for responses
  $timeout(function() {
    if (responsesArray.indexOf(true) > -1) {
      self.gameRunning = true;
      self.gameInProgress = true;
      self.waitingToJoin = true;
    } else {
      self.waitingToJoin = false;
      socket.emit('getPlayerInfo');
    }
  }, 1000);


  // Check if user is logged in
  function isLoggedIn() {
    return !!CurrentUser.getUser();
  }


  // Get user id of logged in user
  function getUserId() {
    if (isLoggedIn()) {
      return CurrentUser.getUser()._id;
    } else {
      return "";
    }
  }


  // Function for highlighting text
  function selectText(element) {
    var doc = document,
        text = doc.getElementById(element),
        range,
        selection;
    if (doc.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) {
        selection = window.getSelection();        
        range = document.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
    }
  }

  // jQuery workaround for 'highlight on click' functionality
  $(function() {
      $('#race-shareLinkUrl').click(function () {
          selectText('race-shareLinkDiv');
      });
  });


  // Get paragraph text
  function getText() {
    return content[Math.floor(Math.random()*content.length)];
  }


  // Update temporary username
  function updateUsername() {
    var nameAlreadyExists = false;

    Object.keys(self.playerData).forEach(function(id) {
      if (self.playerData[id].name.toLowerCase() === self.tempName.toLowerCase()) {
        nameAlreadyExists = true;
        self.tempName = "";
      }
    });

    if (!nameAlreadyExists && self.tempName.length>0 && self.tempName.length<=20) {
      self.name = self.tempName;
      socket.emit('sendingNewNameToServer',{id: socket.id, name:self.name});
      self.tempName = "";
    } else {
      alert('Please pick another name (unique and under 20 characters long');
    }
  }


  // Calculate WPM and percentage complete
  function updateStats(time) {
    self.myData['wpm'] = Math.floor((self.typedSoFar.length*1.0/5)/time) + ' WPM';
    var percentageComplete = (self.typedSoFar.length/paragraphText.length)*100;
    socket.emit('sendingStatsToServer', {id: socket.id, percentage: percentageComplete, wpm: self.myData.wpm});
    self.myData['percentage'] = percentageComplete;
  }


  // Update paragraph text
  function updateState() {
  	if (nextWord.lastIndexOf(self.inputText, 0) === 0) { // Character match
  		self.incorrect = false
      if (wordIndex===0) self.typeboxPlaceholder = "";
  		paragraphHtmlArray[wordIndex+1] = "<span class='correct'>" + nextWord.trim() + "</span>";
  		if (self.inputText.length == nextWord.length) {
  			self.typedSoFar += self.inputText;
  			paragraphHtmlArray[wordIndex+1] = "<span>" + nextWord + "</span>";
  			wordIndex++;
  			if (wordIndex===paragraphWords.length) { // Finished
          self.currentState = 'finished';
  				reachedFinish();
  			} else if (wordIndex===paragraphWords.length-1) { // Next word is final word
  				nextWord = paragraphWords[wordIndex]; // No space after final word
          paragraphHtmlArray[wordIndex+1] = "<span class='correct'>" + nextWord.trim() + "</span>";
  			} else {
  				nextWord = paragraphWords[wordIndex] + " ";
          paragraphHtmlArray[wordIndex+1] = "<span class='correct'>" + nextWord.trim() + "</span>";
  			}
  			self.inputText = "";
  		}
  	} else { // Typed wrong character
  		self.incorrect = true;
  		paragraphHtmlArray[wordIndex+1] = "<span class='incorrect'>" + nextWord.trim() + "</span>";
  	}
  	self.paragraphHtmlString = paragraphHtmlArray.join(" ");
  }


  // Render paragraph on page
  function renderParagraph() {
  	return $sce.trustAsHtml(self.paragraphHtmlString);
  }


  // Convert position to ordinal
  function convertToOrdinal(n) {
    var ords = {1: 'st', 2: 'nd', 3: 'rd'};
    if (n==='') {
      return "";
    } else if (n==='DNF') {
      return 'DNF';
    } else {
      return n + (ords[n % 100] || 'th');
    }
  }


  // Return number of players still racing
  function playersLeftInRace() {
    var finishedPlayers = 0;
    Object.keys(self.playerData).forEach(function(id) {
      if (self.playerData[id].position) {
        finishedPlayers++;
      }
    });
    return self.noOfPlayersInRound - finishedPlayers;
  }


  // Determine whether players are still racing
  var activePlayers = [];
  function checkIfRoomIsEmpty() {
    $timeout(function() {
      if (activePlayers.length>0) {
      } else {
        self.gameRunning = false;
        self.waitingToJoin = false;
        socket.emit('getPlayerInfo');
        $scope.$apply();
      }
    }, 2000);
  }

  
  // Save race result to database
  function saveRace(race) {
    var race = { race: { wpm: parseInt(self.myData.wpm), user: CurrentUser.getUser()._id } };

    Race.save(race, function(data) {
    });
  }


  // Send 'reached finish' message to other players
  function reachedFinish() {
    self.inputText = "";
    self.inputDisabled = true;

    socket.emit('sendingStatsToServer', {id: socket.id, percentage: 100, wpm: self.myData.wpm});
    self.myData['percentage'] = 100;

    var myPos = Object.keys(self.playerPositions).length + 1  // potential bug if players finish at almost the same time
    self.playerPositions[socket.id] = myPos;
    self.myData.position = convertToOrdinal(myPos);

    if (playersLeftInRace()===0) {
      socket.emit('endingGame', {id: socket.id, position: myPos});
    } else {
      socket.emit('completedRace', {id: socket.id, position: myPos});
    }

    if (isLoggedIn()) {
      saveRace();
    }
  }


  // Send 'DNF' message to other players
  function didNotFinish() {
    $interval.cancel(timerInterval);
    self.currentState = 'finished';
    self.inputText = "";
    self.typeboxPlaceholder = "";
    self.incorrect = false;
    self.inputDisabled = true;

    $interval.cancel(timerInterval);
    self.timerText = "0:00";

    self.myData.position = 'DNF';
    socket.emit('endingGame', {id: socket.id, position: 'DNF'});
  }

  
  // Start round timer
  function startTimer(duration) {
  	var timer = duration, minutes, seconds;
  	timerInterval = $interval(function () {
  		minutes = parseInt(timer / 60, 10);
  		seconds = parseInt(timer % 60, 10);

  		if (self.currentState=='racing' && (duration-timer >= 1)) {
  			var minutesElapsed = ((duration-timer)*1.0)/60;
  			updateStats(minutesElapsed);
  		}

      if (self.currentState=='countdown') {
        self.typeboxPlaceholder = "Starting in " + timer + "...";
      }

  		minutes = minutes < 10 ? + minutes : minutes;
  		seconds = seconds < 10 ? "0" + seconds : seconds;

      self.timerText = minutes + ":" + seconds;

      if (--timer < 0) {
  			if (self.currentState==='countdown') {
          self.timerText = "GO!";
          self.typeboxPlaceholder = "Go!";
          self.myData.wpm = "0 WPM";
          Object.keys(self.playerData).forEach(function(player) {
            self.playerData[player].wpm = "0 WPM";
          });
  				self.inputDisabled = false;
  				$interval.cancel(timerInterval);
          self.currentState = 'racing';
  				startTimer(99);
  			} else if (self.currentState==='finished') {
  				$interval.cancel(timerInterval);
  			}	else if (self.currentState==='racing') {
          didNotFinish();
        }
  		}
  	}, 1000);
  }

  
  // Inform players in room to start new game
  function newGame() {
    var text = getText();
    // var text = "This is a short sentence for testing purposes";
    
    // Start game
    socket.emit('startingGame', {text: text});

    paragraphText = text;
    paragraphWords = paragraphText.split(" ");
    startGame();
  }

  // Reset game state
  function startGame() {
  	self.gameRunning = true;
  	self.inputDisabled = true;
    self.noOfPlayersInRound = Object.keys(self.playerData).length;
    
    self.tempName = "";
    self.inputText = "";
    self.typedSoFar = "";
    self.typeboxPlaceholder = "Get ready..."
    self.myData = {percentage: "", wpm: "", position: ""};
    self.playerData = {};
    self.playerPositions = {};
  	wordIndex = 0;

    // Refresh player info
    socket.emit('getPlayerInfo');

  	nextWord = paragraphText.split(" ")[0] + " ";
  	paragraphHtmlArray = paragraphText.split(" ");
  	paragraphHtmlArray.unshift("<p>");
  	paragraphHtmlArray.push("</p");
  	paragraphHtmlArray[1] = "<span class='correct'>" + nextWord.trim() + "</span>";
  	self.paragraphHtmlString = paragraphHtmlArray.join(" ");
    self.currentState = 'countdown';
  	startTimer(3); // Set timer
  }



  /*****************
   Socket messages
  ******************/
  
  // Start game
  socket.on('startGame', function(data) {
    paragraphText = data.text;
    paragraphWords = paragraphText.split(" ");
    startGame();
  });

  // Update player's WPM and percentage complete stats
  socket.on('updatePlayerStats', function(data) {
    if (!self.waitingToJoin) {
      self.playerData[data.id].percentage = data.percentage;
      self.playerData[data.id].wpm = data.wpm;
    }
  });

  // Get info of other players
  socket.on('refreshPlayerInfo', function(data) {
    if (self.waitingToJoin) {
      activePlayers.push(data.id);
    } else if (self.currentState!=='racing') {
      self.playerData[data.id] = {};
      self.playerData[data.id].percentage = data.percentage;
      self.playerData[data.id].wpm = data.wpm;
      self.playerData[data.id].position = data.position;
      self.playerData[data.id].name = data.name;
      self.playerData[data.id].registered = data.registered;
      self.playerData[data.id].userId = data.userId;
      $scope.$apply();
    }
  });

  // Set quitting player's position to DNF if game is running
  socket.on('playerLeft', function(data) {
    if (self.gameRunning && !self.waitingToJoin && self.playerData[data.id].position==="") {
      self.playerData[data.id].position = 'DNF';
      
      // End game if there are no remaining active players
      if (self.currentState==='finished' && playersLeftInRace()===0) {
        socket.emit('endingGame', {id: socket.id, position: self.myData.position});
      }

      $scope.$apply();
    } else if (self.waitingToJoin) {
      // Check if room is empty
      activePlayers = [];
      checkIfRoomIsEmpty();
      socket.emit('getPlayerInfo');
    }
  });

  // Show finished player's position
  socket.on('showPlayerPosition', function(data) {
    if (!self.waitingToJoin) {
      if (data.position!=='DNF') {
        self.playerPositions[data.id] = data.position;
      }

      self.playerData[data.id].position = convertToOrdinal(data.position);
      $scope.$apply();
    }
  });

  // Send own player info to server
  socket.on('sendInfoToServer', function() {
    if (!self.waitingToJoin) {
      socket.emit('passingInfoToServer', {id: socket.id, name: self.name, percentage: self.myData.percentage, wpm: self.myData.wpm, position: self.myData.position, registered: isLoggedIn(), userId: getUserId()});
    }
  });

  // Update player's name
  socket.on('updatePlayerName', function(data) {
    self.playerData[data.id].name = data.name;
    $scope.$apply();
  });

  // Refresh info of players in room
  socket.on('removeUser', function() {
    if (!self.gameRunning) {
      self.playerData = {};
      socket.emit('passingInfoToServer', {id: socket.id, name: self.name, percentage: self.myData.percentage, wpm: self.myData.wpm, position: self.myData.position, registered: isLoggedIn(), userId: getUserId()});
      $scope.$apply();
    }
  });

  // Inform server of current game state
  socket.on('sendGameState', function() {
    if (!self.waitingToJoin) {
      socket.emit('sendingGameStateToServer', {gameRunning: self.gameRunning});
    }
  });

  // Stop timer and join room if waiting to join
  socket.on('endGame', function() {
    self.gameRunning = false;
    if (self.waitingToJoin) {
      self.waitingToJoin = false;
      socket.emit('getPlayerInfo');
    } else if (self.currentState==="racing") {
      didNotFinish();
    } else {
      $interval.cancel(timerInterval);
    }
    self.timerText = "End of race";
    $scope.$apply();
  });

  // Allow waiting players to enter lobby
  socket.on('releaseWaitLock', function() {
    if (self.waitingToJoin) {
      self.gameRunning = false;
      self.waitingToJoin = false;
      socket.emit('getPlayerInfo');
      $scope.$apply();
    }
  });

  // Cancel interval
  socket.on('stopClock', function(data) {
    $interval.cancel(timerInterval);
    
    // Inform server that no active players remain in room
    if (playersLeftInRace()===0) {
      socket.emit('noPlayersLeftInRace', {room: data.room});
    }
  });

  return self;

 }