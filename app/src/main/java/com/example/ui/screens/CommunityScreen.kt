package com.example

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.ui.theme.*

data class CommunityPost(
    val postId: String,
    val authorName: String,
    val location: String,
    val cropName: String,
    val cropEmoji: String,
    val timeAgo: String,
    val questionText: String,
    val translatedText: String? = null,
    val verifiedSolution: String? = null,
    val upvotesCount: Int,
    val answersCount: Int,
    val mediaUrl: String? = null,
    val mediaType: String? = null
)

@Composable
fun CommunityScreen(
    onNavigateToChat: () -> Unit = {}
) {
    var selectedCropFilter by remember { mutableStateOf("All") }
    var translatedPostIds by remember { mutableStateOf(setOf<String>()) }

    val cropFilters = listOf("All", "Cotton", "Rice / Paddy", "Chilli", "Tomato", "Wheat", "Tobacco")

    val samplePosts = remember {
        listOf(
            CommunityPost(
                postId = "POST-1",
                authorName = "Suresh Reddy",
                location = "Guntur, Andhra Pradesh",
                cropName = "Chilli",
                cropEmoji = "🌶️",
                timeAgo = "2 hours ago",
                questionText = "మిరప ఆకుల అడుగున నల్లటి మచ్చలు వస్తున్నాయి. పురుగు మందు ఏమి కొట్టాలి?",
                translatedText = "Black spots appearing under chilli leaves. Which pesticide spray should I use?",
                verifiedSolution = "Agri-Expert Solution: This is Cercospora Leaf Spot. Spray Azoxystrobin + Difenoconazole @ 1ml/L during morning hours.",
                upvotesCount = 24,
                answersCount = 7,
                mediaUrl = "https://images.unsplash.com/photo-1592417817098-8f3d6eb22509?w=600&auto=format&fit=crop",
                mediaType = "image"
            ),
            CommunityPost(
                postId = "POST-2",
                authorName = "Gurpreet Singh",
                location = "Bathinda, Punjab",
                cropName = "Cotton",
                cropEmoji = "🌾",
                timeAgo = "5 hours ago",
                questionText = "कपास के पत्तों में पीलापन और मुड़ाव आ रहा है। क्या यह सफेद मक्खी का प्रकोप है?",
                translatedText = "Cotton leaves turning yellow and curling. Is this Whitefly attack?",
                verifiedSolution = "Agri-Expert Solution: Yes, Cotton Leaf Curl Virus spread by Whitefly. Install Yellow Sticky Traps @ 10/acre and spray Neemastra (5%).",
                upvotesCount = 42,
                answersCount = 12,
                mediaUrl = "https://images.unsplash.com/photo-1607672632458-9eb56696346b?w=600&auto=format&fit=crop",
                mediaType = "image"
            ),
            CommunityPost(
                postId = "POST-3",
                authorName = "Ramesh Patil",
                location = "Nashik, Maharashtra",
                cropName = "Tomato",
                cropEmoji = "🍅",
                timeAgo = "1 day ago",
                questionText = "टोमॅटो फळांवर काळे डाग पडत आहेत. कॅल्शियमची कमतरता आहे का?",
                translatedText = "Black spots on bottom of tomato fruits. Is this calcium deficiency?",
                verifiedSolution = "Agri-Expert Solution: Blossom End Rot caused by calcium deficiency and irregular watering. Apply Calcium Nitrate @ 5g/L as foliar spray.",
                upvotesCount = 19,
                answersCount = 5,
                mediaUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                mediaType = "video"
            )
        )
    }

    val filteredPosts = if (selectedCropFilter == "All") samplePosts else samplePosts.filter { it.cropName.contains(selectedCropFilter) }

    Scaffold(
        containerColor = PlantixBackground,
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNavigateToChat,
                containerColor = PlantixPrimary,
                contentColor = Color.White,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.padding(bottom = 80.dp)
            ) {
                Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Ask Community", fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Farmer Community Feed", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = PlantixText)
                    Text("Connect, ask questions & learn from verified experts", fontSize = 12.sp, color = PlantixTextMuted)
                }
                IconButton(onClick = { /* Search */ }) {
                    Icon(Icons.Default.Search, contentDescription = "Search", tint = PlantixTextMuted)
                }
            }

            // Crop Filter Chips Horizontal Row
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(cropFilters) { filter ->
                    val isSelected = selectedCropFilter == filter
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) PlantixPrimary else Color(0xFFEFF3EF))
                            .clickable { selectedCropFilter = filter }
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Text(
                            filter,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) Color.White else PlantixText
                        )
                    }
                }
            }

            HorizontalDivider(color = PlantixBorder)

            // Posts Feed
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                items(filteredPosts) { post ->
                    val isTranslated = translatedPostIds.contains(post.postId)
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            // Author & Location Header
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(CircleShape)
                                            .background(PlantixBadgeGreen),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(post.cropEmoji, fontSize = 20.sp)
                                    }
                                    Spacer(Modifier.width(10.dp))
                                    Column {
                                        Text(post.authorName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PlantixText)
                                        Text("${post.location} • ${post.timeAgo}", fontSize = 11.sp, color = PlantixTextMuted)
                                    }
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color(0xFFEFF3EF))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(post.cropName, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PlantixPrimary)
                                }
                            }

                            Spacer(Modifier.height(12.dp))

                            // Question Text
                            Text(
                                text = if (isTranslated && post.translatedText != null) post.translatedText else post.questionText,
                                fontSize = 14.sp,
                                color = PlantixText,
                                lineHeight = 20.sp
                            )

                            // Translate Button
                            if (post.translatedText != null) {
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = if (isTranslated) "Show Original Language" else "Translate to English",
                                    fontSize = 11.sp,
                                    color = PlantixActionBlue,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.clickable {
                                        translatedPostIds = if (isTranslated) translatedPostIds - post.postId else translatedPostIds + post.postId
                                    }
                                )
                            }

                            // Attached Media Preview (Image or Video)
                            post.mediaUrl?.let { url ->
                                Spacer(Modifier.height(10.dp))
                                val isVideo = post.mediaType.equals("video", ignoreCase = true) || url.endsWith(".mp4", ignoreCase = true)
                                if (isVideo) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(180.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(Color(0xFF0F172A)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Column(
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.Center
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(48.dp)
                                                    .clip(CircleShape)
                                                    .background(PlantixPrimary.copy(alpha = 0.9f)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    Icons.Filled.PlayArrow,
                                                    contentDescription = "Play Video",
                                                    tint = Color.White,
                                                    modifier = Modifier.size(30.dp)
                                                )
                                            }
                                            Spacer(Modifier.height(8.dp))
                                            Text(
                                                "Field Video Recording",
                                                color = Color.White,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }
                                    }
                                } else {
                                    AsyncImage(
                                        model = url,
                                        contentDescription = "Attached field photo",
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(180.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(Color(0xFFEFF3EF)),
                                        contentScale = ContentScale.Crop
                                    )
                                }
                            }

                            // Verified Solution Card
                            post.verifiedSolution?.let { sol ->
                                Spacer(Modifier.height(10.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFE8F5E9))
                                        .border(1.dp, PlantixPrimary.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                                        .padding(12.dp)
                                ) {
                                    Row {
                                        Icon(Icons.Filled.Verified, contentDescription = null, tint = PlantixPrimary, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text(sol, fontSize = 12.sp, color = PlantixDarkGreen, lineHeight = 17.sp)
                                    }
                                }
                            }

                            Spacer(Modifier.height(12.dp))
                            HorizontalDivider(color = PlantixBorder)
                            Spacer(Modifier.height(8.dp))

                            // Action footer (Upvotes, Answers, Share)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Filled.ThumbUp, contentDescription = null, tint = PlantixTextMuted, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("${post.upvotesCount} Helpful", fontSize = 11.sp, color = PlantixTextMuted)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Filled.ChatBubbleOutline, contentDescription = null, tint = PlantixTextMuted, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("${post.answersCount} Answers", fontSize = 11.sp, color = PlantixTextMuted)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Filled.Share, contentDescription = null, tint = PlantixTextMuted, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Share", fontSize = 11.sp, color = PlantixTextMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
