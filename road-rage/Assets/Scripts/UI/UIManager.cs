using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Drives all in-game and end-of-game UI.
///
/// HUD elements (wire up in Inspector):
///   - scoreText          TMP label showing current cake/coffee count
///   - timerText          TMP label showing seconds remaining
///   - timerBar           Image (Filled) representing time left
///
/// Panels (assign via Inspector):
///   - gameOverPanel      Shown when the 60 s session ends
///   - leaderboardPanel   Full-screen leaderboard overlay
///   - nameEntryPanel     Shown on first play to capture the player's name
///
/// Score popup:
///   - scorePopupPrefab   Floating "+N ☕" prefab instantiated on each hit
///   - popupCanvas        Canvas/RectTransform to parent popups into
/// </summary>
public class UIManager : MonoBehaviour
{
    [Header("HUD")]
    public TextMeshProUGUI scoreText;
    public TextMeshProUGUI timerText;
    public Image timerBar;

    [Header("Score Popup")]
    public GameObject scorePopupPrefab;
    public RectTransform popupCanvas;

    [Header("Game Over Panel")]
    public GameObject gameOverPanel;
    public TextMeshProUGUI finalScoreText;
    public TextMeshProUGUI rankText;
    public TextMeshProUGUI funnyMessageText;
    public Button playAgainButton;
    public Button leaderboardButton;

    [Header("Leaderboard Panel")]
    public GameObject leaderboardPanel;
    public Transform leaderboardContent;
    public GameObject leaderboardEntryPrefab;
    public Button closeLeaderboardButton;

    [Header("Name Entry Panel")]
    public GameObject nameEntryPanel;
    public TMP_InputField nameInputField;
    public Button submitNameButton;

    static readonly string[] FunnyMessages =
    {
        "The road is clear!",
        "Zombie apocalypse? Sorted.",
        "That's what I call traffic management!",
        "Excellent driving, sir.",
        "The council thanks you.",
        "Undead? More like under-tyre.",
        "Perfect run!",
        "They never saw you coming."
    };

    GameManager gm;
    float gameDuration;

    void Start()
    {
        gm = GameManager.Instance;
        gameDuration = gm.GetTimeRemaining();

        gm.OnScoreChanged += RefreshScore;
        gm.OnTimeChanged += RefreshTimer;
        gm.OnGameOver += ShowGameOver;
        gm.OnZombieHit += SpawnScorePopup;

        gameOverPanel.SetActive(false);
        leaderboardPanel.SetActive(false);
        nameEntryPanel.SetActive(false);

        playAgainButton.onClick.AddListener(gm.RestartGame);
        leaderboardButton.onClick.AddListener(OpenLeaderboard);
        closeLeaderboardButton.onClick.AddListener(() => leaderboardPanel.SetActive(false));
        submitNameButton.onClick.AddListener(OnNameSubmitted);

        RefreshScore(0);
        RefreshTimer(gameDuration);
    }

    void OnDestroy()
    {
        if (gm == null) return;
        gm.OnScoreChanged -= RefreshScore;
        gm.OnTimeChanged -= RefreshTimer;
        gm.OnGameOver -= ShowGameOver;
        gm.OnZombieHit -= SpawnScorePopup;
    }

    // ── HUD ──────────────────────────────────────────────────────────────────

    void RefreshScore(int score)
    {
        // Represent score as alternating cake/coffee icons in the label
        int cakes   = score / 2;
        int coffees = score - cakes;
        scoreText.text = $"{"🍰".PadRight(cakes + 1, '🍰').Substring(0, cakes)}{"☕".PadRight(coffees + 1, '☕').Substring(0, coffees)}  {score}";
        // Simpler fallback if emoji rendering is unavailable:
        // scoreText.text = $"Score: {score}";
    }

    void RefreshTimer(float remaining)
    {
        int sec = Mathf.CeilToInt(remaining);
        timerText.text = sec.ToString();
        if (timerBar) timerBar.fillAmount = remaining / gameDuration;

        // Flash red in the final 10 seconds
        bool flash = remaining <= 10f;
        timerText.color = flash
            ? Color.Lerp(Color.red, Color.white, Mathf.PingPong(Time.time * 4f, 1f))
            : Color.white;
    }

    // ── Score popup ───────────────────────────────────────────────────────────

    void SpawnScorePopup(int delta, Vector3 worldPos)
    {
        if (scorePopupPrefab == null || popupCanvas == null) return;

        Vector2 screenPos = Camera.main.WorldToScreenPoint(worldPos);
        GameObject go = Instantiate(scorePopupPrefab, popupCanvas);
        ((RectTransform)go.transform).anchoredPosition = ScreenToCanvas(screenPos);
        go.GetComponent<ScorePopup>()?.Show(delta);
    }

    Vector2 ScreenToCanvas(Vector2 screenPos)
    {
        RectTransformUtility.ScreenPointToLocalPointInRectangle(
            popupCanvas, screenPos, null, out Vector2 local);
        return local;
    }

    // ── Game over ─────────────────────────────────────────────────────────────

    void ShowGameOver()
    {
        int score = gm.GetScore();
        finalScoreText.text = $"{score} points";
        rankText.text = $"Rank #{LeaderboardManager.Instance.GetRank(score)}";
        funnyMessageText.text = FunnyMessages[Random.Range(0, FunnyMessages.Length)];

        // Ask for name on first launch
        string savedName = PlayerPrefs.GetString("PlayerName", "");
        if (string.IsNullOrEmpty(savedName))
            nameEntryPanel.SetActive(true);
        else
            gameOverPanel.SetActive(true);
    }

    void OnNameSubmitted()
    {
        string name = nameInputField.text.Trim();
        if (string.IsNullOrEmpty(name)) name = "Unknown Driver";
        PlayerPrefs.SetString("PlayerName", name);
        PlayerPrefs.Save();

        // Re-submit with the now-known name
        LeaderboardManager.Instance.SubmitScore(name, gm.GetScore());

        nameEntryPanel.SetActive(false);
        gameOverPanel.SetActive(true);

        // Refresh rank now name is set
        int score = gm.GetScore();
        rankText.text = $"Rank #{LeaderboardManager.Instance.GetRank(score)}";
    }

    // ── Leaderboard ───────────────────────────────────────────────────────────

    void OpenLeaderboard()
    {
        PopulateLeaderboard();
        leaderboardPanel.SetActive(true);
    }

    void PopulateLeaderboard()
    {
        foreach (Transform child in leaderboardContent)
            Destroy(child.gameObject);

        var entries = LeaderboardManager.Instance.GetTopScores(10);
        for (int i = 0; i < entries.Count; i++)
        {
            GameObject go = Instantiate(leaderboardEntryPrefab, leaderboardContent);
            go.GetComponent<LeaderboardEntryUI>()?.Populate(i + 1, entries[i]);
        }
    }
}
