SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

DROP TABLE IF EXISTS `@events`;
CREATE TABLE `@events` (
  `eventId`  bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category` varchar(64) CHARACTER SET ascii NOT NULL,
  `streamId` char(36) CHARACTER SET ascii NOT NULL,
  `number`   int(10) unsigned DEFAULT NULL,
  `type`     varchar(64) CHARACTER SET ascii NOT NULL,
  `version`  int(10) unsigned DEFAULT '0',
  `date`     date NOT NULL,
  `time`     time(3) NOT NULL,
  `data`     longtext NOT NULL,
  `meta`     text DEFAULT NULL,
  PRIMARY KEY (`eventId`),
  UNIQUE KEY `category_streamId_number` (`category`,`streamId`,`number`),
  KEY `category_eventId` (`category`,`eventId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


DROP TABLE IF EXISTS `@states`;
CREATE TABLE `@states` (
  `owner` varchar(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `stateId` varchar(128) CHARACTER SET ascii NOT NULL,
  `version` char(32) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `revision` int(10) unsigned NOT NULL,
  `data` longtext NOT NULL,
  PRIMARY KEY (`owner`,`stateId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


DROP TABLE IF EXISTS `@subscriptions`;
CREATE TABLE `@subscriptions` (
  `subscriptionId` varchar(128) CHARACTER SET ascii NOT NULL,
  `position` bigint(20) NOT NULL,
  PRIMARY KEY (`subscriptionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
