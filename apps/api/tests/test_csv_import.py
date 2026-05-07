"""Tests for the CSV import service.

Covers every public parse function and all validation/edge-case paths
defined in app.services.csv_import_service.
"""

from __future__ import annotations

import io
import time

import pytest

from app.csv_import_service import (
    CsvValidationError,
    LineupRow,
    MatchHistoryRow,
    PlayerStatsRow,
    _parse_bool,
    _read_csv,
    _strip_bom,
    _to_float,
    _to_int,
    _validate_headers,
    parse_lineup_csv,
    parse_match_history_csv,
    parse_player_stats_csv,
)


# ---------------------------------------------------------------------------
# Fixtures – raw CSV content
# ---------------------------------------------------------------------------

VALID_LINEUP_CSV = """\
team_name,player_name,position,shirt_number,is_starter,x,y
Arsenal,Bukayo Saka,RW,7,true,75.0,25.0
Arsenal,Martin Odegaard,CM,8,true,50.0,40.0
Chelsea,Cole Palmer,AM,20,true,55.0,50.0
"""

VALID_PLAYER_STATS_CSV = """\
player_name,team_name,position,appearances,goals,assists,xg,xa,yellow_cards,red_cards,minutes_played,rating
Bukayo Saka,Arsenal,RW,32,14,11,12.5,9.8,3,0,2780,7.45
Cole Palmer,Chelsea,AM,30,20,9,17.1,7.2,5,1,2600,7.80
"""

VALID_MATCH_HISTORY_CSV = """\
date,home_team,away_team,home_score,away_score,competition,venue
2026-04-20,Arsenal,Chelsea,2,1,Premier League,Emirates Stadium
2026-04-13,Chelsea,Arsenal,0,0,Premier League,Stamford Bridge
"""


# ---------------------------------------------------------------------------
# Valid CSV parsing
# ---------------------------------------------------------------------------


class TestParseLineupCsv:
    def test_valid_csv(self):
        rows = parse_lineup_csv(VALID_LINEUP_CSV)
        assert len(rows) == 3
        assert rows[0] == LineupRow(
            team_name="Arsenal",
            player_name="Bukayo Saka",
            position="RW",
            shirt_number=7,
            is_starter=True,
            x=75.0,
            y=25.0,
        )
        assert rows[2].is_starter is True
        assert rows[2].x == 55.0

    def test_valid_csv_with_false_starter(self):
        csv_content = """\
team_name,player_name,position,shirt_number,is_starter,x,y
Arsenal,David Raya,GK,1,true,5.0,50.0
Arsenal,Neto,GK,32,false,5.0,50.0
"""
        rows = parse_lineup_csv(csv_content)
        assert rows[0].is_starter is True
        assert rows[1].is_starter is False


class TestParsePlayerStatsCsv:
    def test_valid_csv(self):
        rows = parse_player_stats_csv(VALID_PLAYER_STATS_CSV)
        assert len(rows) == 2
        assert rows[0] == PlayerStatsRow(
            player_name="Bukayo Saka",
            team_name="Arsenal",
            position="RW",
            appearances=32,
            goals=14,
            assists=11,
            xg=12.5,
            xa=9.8,
            yellow_cards=3,
            red_cards=0,
            minutes_played=2780,
            rating=7.45,
        )


class TestParseMatchHistoryCsv:
    def test_valid_csv(self):
        rows = parse_match_history_csv(VALID_MATCH_HISTORY_CSV)
        assert len(rows) == 2
        assert rows[0] == MatchHistoryRow(
            date="2026-04-20",
            home_team="Arsenal",
            away_team="Chelsea",
            home_score=2,
            away_score=1,
            competition="Premier League",
            venue="Emirates Stadium",
        )


# ---------------------------------------------------------------------------
# Missing headers
# ---------------------------------------------------------------------------


class TestMissingHeaders:
    def test_lineup_missing_columns(self):
        csv_content = """\
team_name,player_name,position,shirt_number
Arsenal,Saka,RW,7
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv(csv_content)
        assert any("missing required column" in e for e in exc_info.value.errors)

    def test_player_stats_missing_columns(self):
        csv_content = """\
player_name,team_name,appearances
Saka,Arsenal,32
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_player_stats_csv(csv_content)
        assert any("missing required column" in e for e in exc_info.value.errors)

    def test_match_history_missing_columns(self):
        csv_content = """\
date,home_team,away_team
2026-04-20,Arsenal,Chelsea
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_match_history_csv(csv_content)
        assert any("missing required column" in e for e in exc_info.value.errors)


# ---------------------------------------------------------------------------
# Invalid data types
# ---------------------------------------------------------------------------


class TestInvalidDataTypes:
    def test_lineup_non_integer_shirt_number(self):
        csv_content = """\
team_name,player_name,position,shirt_number,is_starter,x,y
Arsenal,Saka,RW,abc,true,75.0,25.0
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv(csv_content)
        assert any("shirt_number" in e and "int" in e for e in exc_info.value.errors)

    def test_lineup_non_boolean_is_starter(self):
        csv_content = """\
team_name,player_name,position,shirt_number,is_starter,x,y
Arsenal,Saka,RW,7,maybe,75.0,25.0
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv(csv_content)
        assert any("is_starter" in e and "bool" in e for e in exc_info.value.errors)

    def test_lineup_non_float_coordinates(self):
        csv_content = """\
team_name,player_name,position,shirt_number,is_starter,x,y
Arsenal,Saka,RW,7,true,abc,25.0
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv(csv_content)
        assert any("x" in e and "float" in e for e in exc_info.value.errors)

    def test_player_stats_non_integer_goals(self):
        csv_content = """\
player_name,team_name,position,appearances,goals,assists,xg,xa,yellow_cards,red_cards,minutes_played,rating
Saka,Arsenal,RW,32,many,11,12.5,9.8,3,0,2780,7.45
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_player_stats_csv(csv_content)
        assert any("goals" in e and "int" in e for e in exc_info.value.errors)

    def test_player_stats_non_float_rating(self):
        csv_content = """\
player_name,team_name,position,appearances,goals,assists,xg,xa,yellow_cards,red_cards,minutes_played,rating
Saka,Arsenal,RW,32,14,11,12.5,9.8,3,0,2780,great
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_player_stats_csv(csv_content)
        assert any("rating" in e and "float" in e for e in exc_info.value.errors)

    def test_match_history_non_integer_score(self):
        csv_content = """\
date,home_team,away_team,home_score,away_score,competition,venue
2026-04-20,Arsenal,Chelsea,two,1,Premier League,Emirates
"""
        with pytest.raises(CsvValidationError) as exc_info:
            parse_match_history_csv(csv_content)
        assert any("home_score" in e and "int" in e for e in exc_info.value.errors)


# ---------------------------------------------------------------------------
# Empty file
# ---------------------------------------------------------------------------


class TestEmptyFile:
    def test_empty_string_lineup(self):
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv("")
        assert any("empty" in e.lower() or "no headers" in e.lower() for e in exc_info.value.errors)

    def test_empty_string_player_stats(self):
        with pytest.raises(CsvValidationError):
            parse_player_stats_csv("")

    def test_empty_string_match_history(self):
        with pytest.raises(CsvValidationError):
            parse_match_history_csv("")

    def test_whitespace_only(self):
        with pytest.raises(CsvValidationError):
            parse_lineup_csv("   \n  \n  ")

    def test_header_only_no_data_rows(self):
        csv_content = "team_name,player_name,position,shirt_number,is_starter,x,y\n"
        rows = parse_lineup_csv(csv_content)
        assert rows == []


# ---------------------------------------------------------------------------
# UTF-8 BOM handling
# ---------------------------------------------------------------------------


class TestUtf8BomHandling:
    def test_bom_stripped_lineup(self):
        csv_content = "\ufeff" + VALID_LINEUP_CSV
        rows = parse_lineup_csv(csv_content)
        assert len(rows) == 3
        assert rows[0].player_name == "Bukayo Saka"

    def test_bom_stripped_player_stats(self):
        csv_content = "\ufeff" + VALID_PLAYER_STATS_CSV
        rows = parse_player_stats_csv(csv_content)
        assert len(rows) == 2
        assert rows[0].goals == 14

    def test_bom_stripped_match_history(self):
        csv_content = "\ufeff" + VALID_MATCH_HISTORY_CSV
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 2
        assert rows[0].home_score == 2

    def test_strip_bom_helper(self):
        assert _strip_bom("\ufeffhello") == "hello"
        assert _strip_bom("hello") == "hello"
        assert _strip_bom("\ufeff\ufeffhello") == "hello"


# ---------------------------------------------------------------------------
# 8. Extra columns -> ignored gracefully
# ---------------------------------------------------------------------------


class TestExtraColumnsIgnored:
    def test_lineup_extra_columns_ignored(self):
        csv_content = (
            "team_name,player_name,position,shirt_number,is_starter,x,y,coach,notes\n"
            "Arsenal,Saka,RW,7,true,75.0,25.0,Arteta,captain\n"
        )
        rows = parse_lineup_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].player_name == "Saka"
        assert rows[0].x == 75.0

    def test_player_stats_extra_columns_ignored(self):
        csv_content = (
            "player_name,team_name,position,appearances,goals,assists,xg,xa,"
            "yellow_cards,red_cards,minutes_played,rating,nationality\n"
            "Saka,Arsenal,RW,32,14,11,12.5,9.8,3,0,2780,7.45,English\n"
        )
        rows = parse_player_stats_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].player_name == "Saka"

    def test_match_history_extra_columns_ignored(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue,referee\n"
            "2026-04-20,Arsenal,Chelsea,2,1,Premier League,Emirates Stadium,Webb\n"
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].venue == "Emirates Stadium"


# ---------------------------------------------------------------------------
# 9. Duplicate rows -> handled (deduplicate or error)
# ---------------------------------------------------------------------------


class TestDuplicateRows:
    def test_duplicate_lineup_rows_parsed_as_present(self):
        """The current parser does not deduplicate -- rows are returned as-is."""
        csv_content = (
            "team_name,player_name,position,shirt_number,is_starter,x,y\n"
            "Arsenal,Saka,RW,7,true,75.0,25.0\n"
            "Arsenal,Saka,RW,7,true,75.0,25.0\n"
        )
        rows = parse_lineup_csv(csv_content)
        # Parser keeps duplicates; callers decide policy
        assert len(rows) == 2
        assert rows[0] == rows[1]

    def test_duplicate_match_history_rows_parsed(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue\n"
            "2026-04-20,Arsenal,Chelsea,2,1,Premier League,Emirates Stadium\n"
            "2026-04-20,Arsenal,Chelsea,2,1,Premier League,Emirates Stadium\n"
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 2

    def test_near_duplicate_different_values_parsed_separately(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue\n"
            "2026-04-20,Arsenal,Chelsea,2,1,Premier League,Emirates Stadium\n"
            "2026-04-20,Arsenal,Chelsea,3,2,Premier League,Emirates Stadium\n"
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 2
        assert rows[0].home_score == 2
        assert rows[1].home_score == 3


# ---------------------------------------------------------------------------
# 10. Very large file -> handles efficiently
# ---------------------------------------------------------------------------


class TestLargeFileHandling:
    @staticmethod
    def _generate_large_lineup_csv(n_rows: int) -> str:
        buf = io.StringIO()
        buf.write("team_name,player_name,position,shirt_number,is_starter,x,y\n")
        for i in range(n_rows):
            buf.write(f"Team {i % 10},Player {i},FWD,{i % 99 + 1},true,50.0,50.0\n")
        return buf.getvalue()

    def test_10k_rows_parsed_under_two_seconds(self):
        csv_content = self._generate_large_lineup_csv(10_000)
        start = time.perf_counter()
        rows = parse_lineup_csv(csv_content)
        elapsed = time.perf_counter() - start
        assert len(rows) == 10_000
        assert elapsed < 2.0, f"10k rows took {elapsed:.2f}s, expected < 2s"

    def test_50k_rows_parsed_under_five_seconds(self):
        csv_content = self._generate_large_lineup_csv(50_000)
        start = time.perf_counter()
        rows = parse_lineup_csv(csv_content)
        elapsed = time.perf_counter() - start
        assert len(rows) == 50_000
        assert elapsed < 5.0, f"50k rows took {elapsed:.2f}s, expected < 5s"

    def test_large_file_values_correct(self):
        """Spot-check that a large parse did not corrupt values."""
        csv_content = self._generate_large_lineup_csv(1_000)
        rows = parse_lineup_csv(csv_content)
        assert rows[0].team_name == "Team 0"
        assert rows[99].team_name == "Team 9"
        assert rows[500].player_name == "Player 500"
        assert rows[999].shirt_number == 100 % 99 + 1  # 2


# ---------------------------------------------------------------------------
# 11. Mixed line endings (CRLF/LF) -> handled
# ---------------------------------------------------------------------------


class TestMixedLineEndings:
    def test_lf_only(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue\n"
            "2026-04-20,Arsenal,Chelsea,2,1,Premier League,Emirates Stadium\n"
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].home_team == "Arsenal"

    def test_crlf_only(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue\r\n"
            "2026-04-20,Arsenal,Chelsea,2,1,Premier League,Emirates Stadium\r\n"
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].home_team == "Arsenal"

    def test_mixed_crlf_and_lf(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue\r\n"
            "2026-04-20,Arsenal,Chelsea,2,1,Premier League,Emirates Stadium\n"
            "2026-04-13,Chelsea,Arsenal,0,0,Premier League,Stamford Bridge\r\n"
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 2
        assert rows[0].home_team == "Arsenal"
        assert rows[1].home_team == "Chelsea"

    def test_crlf_with_lineup_csv(self):
        csv_content = (
            "team_name,player_name,position,shirt_number,is_starter,x,y\r\n"
            "Arsenal,Saka,RW,7,true,75.0,25.0\r\n"
            "Chelsea,Palmer,AM,20,true,55.0,50.0\r\n"
        )
        rows = parse_lineup_csv(csv_content)
        assert len(rows) == 2
        assert rows[1].player_name == "Palmer"

    def test_mixed_endings_with_player_stats(self):
        csv_content = (
            "player_name,team_name,position,appearances,goals,assists,xg,xa,"
            "yellow_cards,red_cards,minutes_played,rating\r\n"
            "Saka,Arsenal,RW,32,14,11,12.5,9.8,3,0,2780,7.45\n"
            "Palmer,Chelsea,AM,30,20,9,17.1,7.2,5,1,2600,7.80\r\n"
        )
        rows = parse_player_stats_csv(csv_content)
        assert len(rows) == 2
        assert rows[0].goals == 14
        assert rows[1].goals == 20


# ---------------------------------------------------------------------------
# 12. Quoted fields with commas -> parsed correctly
# ---------------------------------------------------------------------------


class TestQuotedFieldsWithCommas:
    def test_quoted_team_name_with_comma(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue\n"
            '"2026-04-20","Red, United","Blue City",2,1,"Premier League","Old, Trafford"\n'
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].home_team == "Red, United"
        assert rows[0].venue == "Old, Trafford"

    def test_quoted_player_name_with_comma(self):
        csv_content = (
            "team_name,player_name,position,shirt_number,is_starter,x,y\n"
            '"Arsenal","Doe, John",GK,1,true,50.0,50.0\n'
        )
        rows = parse_lineup_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].player_name == "Doe, John"

    def test_quoted_field_with_embedded_newline(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue\n"
            '"2026-04-20","Arsenal","Chelsea",2,1,"Premier\nLeague","Emirates"\n'
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 1
        assert "Premier" in rows[0].competition
        assert "League" in rows[0].competition

    def test_multiple_quoted_fields_same_row(self):
        csv_content = (
            "date,home_team,away_team,home_score,away_score,competition,venue\n"
            '"2026-04-20","Red, United","Blue, City",2,1,"Premier, League","Old Trafford"\n'
        )
        rows = parse_match_history_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].home_team == "Red, United"
        assert rows[0].away_team == "Blue, City"
        assert rows[0].competition == "Premier, League"

    def test_quoted_field_in_player_stats(self):
        csv_content = (
            "player_name,team_name,position,appearances,goals,assists,xg,xa,"
            "yellow_cards,red_cards,minutes_played,rating\n"
            '"Saka, B","Arsenal",RW,32,14,11,12.5,9.8,3,0,2780,7.45\n'
        )
        rows = parse_player_stats_csv(csv_content)
        assert len(rows) == 1
        assert rows[0].player_name == "Saka, B"


# ---------------------------------------------------------------------------
# Additional: row-number reporting in error messages
# ---------------------------------------------------------------------------


class TestRowNumberReporting:
    def test_error_includes_row_number(self):
        csv_content = (
            "team_name,player_name,position,shirt_number,is_starter,x,y\n"
            "Arsenal,Saka,RW,abc,true,75.0,25.0\n"
        )
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv(csv_content)
        assert any("Row 2" in e for e in exc_info.value.errors)

    def test_error_includes_row_number_third_data_row(self):
        csv_content = (
            "team_name,player_name,position,shirt_number,is_starter,x,y\n"
            "Arsenal,Saka,RW,7,true,75.0,25.0\n"
            "Arsenal,Odegaard,CM,8,true,50.0,40.0\n"
            "Chelsea,Palmer,AM,xyz,true,55.0,50.0\n"
        )
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv(csv_content)
        assert any("Row 4" in e for e in exc_info.value.errors)

    def test_multiple_errors_include_all_row_numbers(self):
        csv_content = (
            "team_name,player_name,position,shirt_number,is_starter,x,y\n"
            "Arsenal,Saka,RW,abc,true,75.0,25.0\n"
            "Arsenal,Odegaard,CM,8,true,50.0,40.0\n"
            "Chelsea,Palmer,AM,xyz,true,qrs,50.0\n"
        )
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv(csv_content)
        errors = exc_info.value.errors
        assert any("Row 2" in e for e in errors)
        assert any("Row 4" in e for e in errors)


# ---------------------------------------------------------------------------
# Additional: header validation details
# ---------------------------------------------------------------------------


class TestHeaderValidationDetails:
    def test_error_mentions_specific_missing_headers(self):
        csv_content = "team_name,player_name\nArsenal,Saka\n"
        with pytest.raises(CsvValidationError) as exc_info:
            parse_lineup_csv(csv_content)
        errors = exc_info.value.errors
        assert any("shirt_number" in e for e in errors)
        assert any("is_starter" in e for e in errors)
        assert any("Expected:" in e for e in errors)

    def test_header_matching_case_insensitive(self):
        csv_content = (
            "TEAM_NAME,PLAYER_NAME,POSITION,SHIRT_NUMBER,IS_STARTER,X,Y\n"
            "Arsenal,Saka,RW,7,true,75.0,25.0\n"
        )
        rows = parse_lineup_csv(csv_content)
        assert len(rows) == 1


# ---------------------------------------------------------------------------
# Additional: helper function unit tests
# ---------------------------------------------------------------------------


class TestParseBoolHelper:
    def test_truthy_values(self):
        for v in ("true", "True", "1", "yes", "y", "t", "YES"):
            assert _parse_bool(v) is True

    def test_falsy_values(self):
        for v in ("false", "False", "0", "no", "n", "f", "NO"):
            assert _parse_bool(v) is False

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="Cannot parse"):
            _parse_bool("maybe")


class TestToIntHelper:
    def test_valid(self):
        assert _to_int("42", "field", 2) == (42, None)

    def test_invalid_returns_error(self):
        val, err = _to_int("abc", "field", 5)
        assert val == 0
        assert err is not None
        assert "Row 5" in err
        assert "abc" in err


class TestToFloatHelper:
    def test_valid(self):
        val, err = _to_float("3.14", "field", 2)
        assert val == pytest.approx(3.14)
        assert err is None

    def test_invalid_returns_error(self):
        val, err = _to_float("xyz", "field", 3)
        assert val == 0.0
        assert err is not None
        assert "Row 3" in err


class TestValidateHeadersHelper:
    def test_no_missing(self):
        assert _validate_headers(["a", "b", "c"], ["a", "b"], "test") == []

    def test_missing_reported(self):
        errors = _validate_headers(["a"], ["a", "b", "c"], "test")
        assert len(errors) == 1
        assert "b" in errors[0]
        assert "c" in errors[0]

    def test_case_insensitive(self):
        assert _validate_headers(["A", "B"], ["a", "b"], "test") == []


class TestReadCsvHelper:
    def test_returns_headers_and_rows(self):
        content = "a,b\n1,2\n3,4\n"
        headers, rows = _read_csv(content)
        assert headers == ["a", "b"]
        assert len(rows) == 2
        assert rows[0]["a"] == "1"

    def test_empty_raises(self):
        with pytest.raises(CsvValidationError, match="empty"):
            _read_csv("")

    def test_bom_stripped(self):
        content = "\ufeffa,b\n1,2\n"
        headers, rows = _read_csv(content)
        assert headers == ["a", "b"]
