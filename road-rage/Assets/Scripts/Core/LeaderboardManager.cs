using UnityEngine;
using System.Collections.Generic;
using System.Linq;

[System.Serializable]
public class LeaderboardEntry
{
    public string playerName;
    public int score;
    public string date;

    public LeaderboardEntry(string name, int score)
    {
        this.playerName = name;
        this.score = score;
        this.date = System.DateTime.Now.ToString("dd/MM/yy");
    }
}

[System.Serializable]
class LeaderboardData
{
    public List<LeaderboardEntry> entries = new List<LeaderboardEntry>();
}

/// <summary>
/// Persists leaderboard data using PlayerPrefs + JSON.
/// Survives app restarts. Stores up to MaxEntries results.
/// </summary>
public class LeaderboardManager : MonoBehaviour
{
    public static LeaderboardManager Instance { get; private set; }

    const string SaveKey = "RoadRage_Leaderboard";
    const int MaxEntries = 20;

    LeaderboardData data;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
        Load();
    }

    public void SubmitScore(string playerName, int score)
    {
        data.entries.Add(new LeaderboardEntry(playerName, score));
        data.entries = data.entries
            .OrderByDescending(e => e.score)
            .Take(MaxEntries)
            .ToList();
        Save();
    }

    /// <summary>Returns the top N entries, highest score first.</summary>
    public List<LeaderboardEntry> GetTopScores(int count = 10)
        => data.entries.OrderByDescending(e => e.score).Take(count).ToList();

    /// <summary>Returns 1-based rank for a given score.</summary>
    public int GetRank(int score)
        => data.entries.Count(e => e.score > score) + 1;

    void Load()
    {
        string json = PlayerPrefs.GetString(SaveKey, "");
        data = string.IsNullOrEmpty(json)
            ? new LeaderboardData()
            : JsonUtility.FromJson<LeaderboardData>(json);
    }

    void Save()
    {
        PlayerPrefs.SetString(SaveKey, JsonUtility.ToJson(data));
        PlayerPrefs.Save();
    }
}
