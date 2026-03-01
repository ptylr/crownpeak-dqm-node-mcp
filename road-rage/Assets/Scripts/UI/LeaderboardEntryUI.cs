using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Represents a single row in the leaderboard scroll view.
///
/// Prefab hierarchy suggestion:
///   LeaderboardEntry (this script + HorizontalLayoutGroup)
///     ├── RankText       (TMP)
///     ├── NameText       (TMP, flexible width)
///     ├── ScoreText      (TMP)
///     └── DateText       (TMP, small)
/// </summary>
public class LeaderboardEntryUI : MonoBehaviour
{
    public TextMeshProUGUI rankText;
    public TextMeshProUGUI nameText;
    public TextMeshProUGUI scoreText;
    public TextMeshProUGUI dateText;

    [Header("Medal highlights (optional)")]
    public Image backgroundImage;
    public Color goldColor   = new Color(1f,   0.84f, 0f,    0.3f);
    public Color silverColor = new Color(0.75f, 0.75f, 0.75f, 0.3f);
    public Color bronzeColor = new Color(0.8f,  0.5f,  0.2f,  0.3f);

    public void Populate(int rank, LeaderboardEntry entry)
    {
        rankText.text  = $"#{rank}";
        nameText.text  = entry.playerName;
        scoreText.text = $"{entry.score} ☕🍰";
        if (dateText) dateText.text = entry.date;

        if (backgroundImage)
        {
            backgroundImage.color = rank switch
            {
                1 => goldColor,
                2 => silverColor,
                3 => bronzeColor,
                _ => Color.clear
            };
        }
    }
}
